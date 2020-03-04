import { FOLDER_PAGE_SIZE } from '../constants';
import { CreateNewFolder } from '../interfaces/folder';

export const queryFolderChildren = (
    shareID: string,
    linkID: string,
    { Page, PageSize = FOLDER_PAGE_SIZE }: { Page: number; PageSize?: number }
) => ({
    method: 'get',
    url: `drive/shares/${shareID}/folders/${linkID}/children`,
    params: { Page, PageSize }
});

export const queryCreateFolder = (shareID: string, data: CreateNewFolder) => ({
    method: 'post',
    url: `drive/shares/${shareID}/folders`,
    data
});
