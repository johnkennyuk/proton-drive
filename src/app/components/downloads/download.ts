import { generateUID } from 'react-components';
import { orderBy } from 'proton-shared/lib/helpers/array';
import { ReadableStream } from 'web-streams-polyfill';
import { createReadableStreamWrapper } from '@mattiasbuelens/web-streams-adapter';
import { Api } from 'proton-shared/lib/interfaces';
import { DriveFileBlock } from '../../interfaces/file';
import { queryFileBlock } from '../../api/files';
import { ObserverStream, untilStreamEnd } from '../../utils/stream';
import { areUint8Arrays } from '../../utils/array';
import { TransferCancel } from '../../interfaces/transfer';
import runInQueue from '../../utils/runInQueue';
import { waitUntil } from '../../utils/async';
import { MAX_THREADS_PER_DOWNLOAD } from '../../constants';

const MAX_TOTAL_BUFFER_SIZE = 10; // number of blocks
const DOWNLOAD_TIMEOUT = 60000;

const toPolyfillReadable = createReadableStreamWrapper(ReadableStream);

export type StreamTransformer = (stream: ReadableStream<Uint8Array>) => Promise<ReadableStream<Uint8Array>>;

export interface DownloadControls {
    start: (api: (query: any) => any) => Promise<void>;
    cancel: () => void;
    pause: () => Promise<void>;
    resume: () => void;
}

export interface DownloadCallbacks {
    onStart: (stream: ReadableStream<Uint8Array>) => Promise<DriveFileBlock[] | Uint8Array[]>;
    onFinish?: () => void;
    onError?: (err: any) => void;
    onProgress?: (bytes: number) => void;
    transformBlockStream?: StreamTransformer;
}

export const initDownload = ({ onStart, onProgress, onFinish, onError, transformBlockStream }: DownloadCallbacks) => {
    const id = generateUID('drive-transfers');
    const fileStream = new ObserverStream();
    const fsWriter = fileStream.writable.getWriter();

    const buffers = new Map<number, { done: boolean; chunks: Uint8Array[] }>();
    let abortController = new AbortController();
    let paused = false;

    const start = async (api: Api) => {
        if (abortController.signal.aborted) {
            throw new TransferCancel(id);
        }

        const blocksOrBuffer = await onStart(fileStream.readable);

        await fsWriter.ready;

        // If initialized with preloaded buffer instead of blocks to download
        if (areUint8Arrays(blocksOrBuffer)) {
            for (const buffer of blocksOrBuffer) {
                await fsWriter.write(buffer as Uint8Array);
            }
            await fsWriter.ready;
            await fsWriter.close();
            return;
        }

        const flushBuffer = async (Index: number) => {
            const currentBuffer = buffers.get(Index);
            if (currentBuffer?.chunks.length) {
                for (const chunk of currentBuffer.chunks) {
                    await fsWriter.ready;
                    await fsWriter.write(chunk);
                }
                buffers.delete(Index);
            }
        };

        const getBlockQueue = (startIndex = 1) =>
            orderBy(blocksOrBuffer, 'Index').filter(({ Index }) => Index >= startIndex);

        let activeIndex = 1;

        // Downloads several blocks at once, but streams sequentially only one block at a time
        // Other blocks are put into buffer until previous blocks have finished downloading
        const startDownload = async (blockQueue: DriveFileBlock[]) => {
            if (!blockQueue.length) {
                return [];
            }
            activeIndex = blockQueue[0].Index;
            const downloadQueue = blockQueue.map(({ URL, Index }) => async () => {
                if (!buffers.get(Index)?.done) {
                    await waitUntil(() => buffers.size < MAX_TOTAL_BUFFER_SIZE || abortController.signal.aborted);

                    if (abortController.signal.aborted) {
                        throw new TransferCancel(id);
                    }

                    const blockStream = toPolyfillReadable(
                        await api({
                            ...queryFileBlock(URL),
                            timeout: DOWNLOAD_TIMEOUT,
                            signal: abortController.signal
                        })
                    ) as ReadableStream<Uint8Array>;

                    const progressStream = new ObserverStream((value) => onProgress?.(value.length));
                    const rawContentStream = blockStream.pipeThrough(progressStream);

                    // Decrypt the file block content using streaming decryption
                    const transformedContentStream = transformBlockStream
                        ? await transformBlockStream(rawContentStream)
                        : rawContentStream;

                    await untilStreamEnd(transformedContentStream, async (data) => {
                        if (abortController.signal.aborted) {
                            throw new TransferCancel(id);
                        }
                        const buffer = buffers.get(Index);
                        if (buffer) {
                            buffer.chunks.push(data);
                        } else {
                            buffers.set(Index, { done: false, chunks: [data] });
                        }
                    });

                    const currentBuffer = buffers.get(Index);

                    if (currentBuffer) {
                        currentBuffer.done = true;
                    }
                }

                if (Index === activeIndex) {
                    let nextIndex = activeIndex;
                    // Flush buffers for subsequent complete blocks too
                    while (buffers.get(nextIndex)?.done) {
                        await flushBuffer(nextIndex);
                        nextIndex++;
                    }
                    // Assign next incomplete block as new active block
                    activeIndex = nextIndex;
                }
            });

            try {
                await runInQueue(downloadQueue, MAX_THREADS_PER_DOWNLOAD);
            } catch (e) {
                if (!paused) {
                    abortController.abort();
                    fsWriter.abort(e);
                    throw e;
                }

                if (onProgress) {
                    // Revert current block progress
                    let progressToRevert = 0;
                    buffers.forEach((buffer, Index) => {
                        if (!buffer.done) {
                            buffer.chunks.forEach((chunk) => (progressToRevert += chunk.byteLength));
                            buffers.delete(Index);
                        }
                    });
                    onProgress(-progressToRevert);
                }
                await waitUntil(() => paused === false);
                await startDownload(getBlockQueue(activeIndex));
            }
        };

        await startDownload(getBlockQueue());

        // Wait for stream to be flushed
        await fsWriter.ready;
        await fsWriter.close();
    };

    const cancel = () => {
        paused = false;
        abortController.abort();
        fsWriter.abort(new TransferCancel(id));
    };

    const pause = async () => {
        paused = true;
        abortController.abort();

        // Wait for download to reset progress or be flushed
        const allDownloadsStopped = () => {
            for (const [, buffer] of buffers) {
                if (!buffer.done) {
                    return false;
                }
            }
            return true;
        };

        await waitUntil(allDownloadsStopped);
    };

    const resume = () => {
        abortController = new AbortController();
        paused = false;
    };

    const downloadControls: DownloadControls = {
        start: (api) =>
            start(api)
                .then(() => {
                    onFinish?.();
                })
                .catch((err) => {
                    onError?.(err);
                    throw err;
                }),
        cancel,
        pause,
        resume
    };

    return { id, downloadControls };
};
