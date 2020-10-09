import React from 'react';
import { textToClipboard } from 'proton-shared/lib/helpers/browser';
import {
    Alert,
    Button,
    Checkbox,
    FooterModal,
    HeaderModal,
    InnerModal,
    Label,
    PrimaryButton,
    Row,
    useNotifications,
} from 'react-components';
import { c } from 'ttag';

interface Props {
    itemName: string;
    password: string;
    token: string;
    includePassword: boolean;
    modalTitleID: string;
    onClose?: () => void;
    onEditPasswordClick: () => void;
    onIncludePasswordToggle: () => void;
}

function GeneratedLinkState({
    modalTitleID,
    onClose,
    itemName,
    password,
    token,
    includePassword,
    onEditPasswordClick,
    onIncludePasswordToggle,
}: Props) {
    const { createNotification } = useNotifications();
    const baseUrl = `${window.location.origin}/urls`;

    const handleClickCopyURL = () => {
        textToClipboard(includePassword ? `${baseUrl}/${token}#${password}` : `${baseUrl}/${token}`);
        createNotification({ text: c('Success').t`Secure link was copied to the clipboard` });
    };

    const handleCopyPasswordClick = () => {
        textToClipboard(password);
        createNotification({ text: c('Success').t`Password was copied to the clipboard` });
    };

    const boldNameText = (
        <b key="name" className="break">
            {itemName}
        </b>
    );

    return (
        <>
            <HeaderModal modalTitleID={modalTitleID} onClose={onClose}>
                {c('Title').t`Get secure link`}
            </HeaderModal>
            <div className="pm-modalContent">
                <InnerModal>
                    <Alert>{c('Info').jt`Secure link of "${boldNameText}" has been generated.`}</Alert>

                    <Row>
                        <div className="flex flex-item-fluid">
                            <div className="pm-field w100 mb0-5 pl1 pr1 pt0-5 pb0-5 ellipsis">
                                {baseUrl}/{token}
                                {includePassword && <span className="accented">#{password}</span>}
                            </div>
                        </div>
                        <div className="flex flex-justify-end ml0-5 onmobile-ml0">
                            <div>
                                <PrimaryButton onClick={handleClickCopyURL} className="min-w5e">{c('Action')
                                    .t`Copy`}</PrimaryButton>
                            </div>
                        </div>
                    </Row>

                    <Alert>
                        {c('Info').t`A secure password has been generated for you.`}
                        <br />
                        {c('Info').t`Use it in order to decrypt a file after downloading it.`}
                    </Alert>
                    <Row>
                        <Label htmlFor="edit-password">
                            <span className="mr0-5">{c('Label').t`Password protection`}</span>
                        </Label>
                        <div className="flex flex-column flex-item-fluid">
                            <div className="pm-field w100 mb0-5 pl1 pr1 pt0-5 pb0-5 pm-field--accented ellipsis">
                                {password}
                            </div>
                            <Checkbox className="mb0-5" checked={includePassword} onChange={onIncludePasswordToggle}>{c(
                                'Label'
                            ).t`Include password in the link`}</Checkbox>
                        </div>
                        <div className="flex flex-justify-end ml0-5 onmobile-ml0">
                            <div>
                                <Button onClick={onEditPasswordClick} className="min-w5e">{c('Action').t`Edit`}</Button>
                            </div>
                            <div>
                                <Button onClick={handleCopyPasswordClick} className="min-w5e ml0-5">{c('Action')
                                    .t`Copy`}</Button>
                            </div>
                        </div>
                    </Row>
                </InnerModal>
                <FooterModal>
                    <Button onClick={onClose}>{c('Action').t`Done`}</Button>
                </FooterModal>
            </div>
        </>
    );
}

export default GeneratedLinkState;