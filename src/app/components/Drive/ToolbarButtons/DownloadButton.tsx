import React from 'react';
import { c } from 'ttag';

import { ToolbarButton } from 'react-components';

import { useDriveContent } from '../DriveContentProvider';
import { LinkType } from '../../../interfaces/link';
import { getMetaForTransfer } from '../Drive';
import useFiles from '../../../hooks/drive/useFiles';
import FileSaver from '../../../utils/FileSaver/FileSaver';
import usePreventLeave from '../../../hooks/util/usePreventLeave';
import { useDriveActiveFolder } from '../DriveFolderProvider';

interface Props {
    disabled?: boolean;
}

const DownloadButton = ({ disabled }: Props) => {
    const { folder } = useDriveActiveFolder();
    const { startFileTransfer, startFolderTransfer } = useFiles();
    const { fileBrowserControls } = useDriveContent();
    const { selectedItems } = fileBrowserControls;
    const { preventLeave } = usePreventLeave();

    const handleDownloadClick = () => {
        if (!folder) {
            return;
        }
        selectedItems.forEach(async (item) => {
            if (item.Type === LinkType.FILE) {
                const meta = getMetaForTransfer(item);
                const fileStream = await startFileTransfer(folder.shareId, item.LinkID, meta);
                preventLeave(FileSaver.saveAsFile(fileStream, meta));
            } else {
                const zipSaver = await FileSaver.saveAsZip(item.Name);

                if (zipSaver) {
                    try {
                        await preventLeave(
                            startFolderTransfer(item.Name, folder.shareId, item.LinkID, {
                                onStartFileTransfer: zipSaver.addFile,
                                onStartFolderTransfer: zipSaver.addFolder
                            })
                        );
                        zipSaver.close();
                    } catch (e) {
                        zipSaver.abort(e);
                    }
                }
            }
        });
    };

    return (
        <ToolbarButton
            disabled={disabled}
            title={c('Action').t`Download`}
            icon="download"
            onClick={handleDownloadClick}
            data-testid="toolbar-download"
        />
    );
};

export default DownloadButton;
