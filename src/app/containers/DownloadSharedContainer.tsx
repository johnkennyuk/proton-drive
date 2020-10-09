import React, { useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useModals, useLoading, LoaderPage } from 'react-components';

import DownloadSharedModal from '../components/DownloadSharedModal';
import usePublicSharing from '../hooks/drive/usePublicSharing';
import FileSaver from '../utils/FileSaver/FileSaver';

const DownloadSharedContainer = () => {
    const { createModal } = useModals();
    const [loading, withLoading] = useLoading();
    const { getSharedLinkPayload, startSharedFileTransfer } = usePublicSharing();
    const { hash, pathname } = useLocation();

    const token = useMemo(() => pathname.replace('/urls/', ''), [pathname]);
    const password = useMemo(() => hash.replace('#', ''), [hash]);

    const openDownloadSharedModal = useCallback(async () => {
        const { Name, MIMEType, ExpirationTime, Size, NodeKey, SessionKey, Blocks } = await getSharedLinkPayload(
            token,
            password
        );

        const downloadFile = async () => {
            const transferMeta = {
                filename: Name,
                size: Size,
                mimeType: MIMEType,
            };
            const fileStream = await startSharedFileTransfer(Blocks, SessionKey, NodeKey, transferMeta);
            return FileSaver.saveAsFile(fileStream, transferMeta);
        };

        createModal(
            <DownloadSharedModal name={Name} size={Size} expirationTime={ExpirationTime} downloadFile={downloadFile} />
        );
    }, [token, password]);

    useEffect(() => {
        withLoading(openDownloadSharedModal()).catch((err) => {
            console.error(err);
        });
    }, [openDownloadSharedModal]);

    if (loading) {
        return <LoaderPage />;
    }

    return null;
};

export default DownloadSharedContainer;