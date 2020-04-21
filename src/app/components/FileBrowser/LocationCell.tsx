import React, { useEffect, useState } from 'react';
import { c } from 'ttag';

import useDrive from '../../hooks/useDrive';
import { FileBrowserItem } from './FileBrowser';

interface Props {
    shareId: string;
    item: FileBrowserItem;
}

const LocationCell = ({ item, shareId }: Props) => {
    const [location, setLocation] = useState<string>();
    const { getLinkMeta } = useDrive();

    useEffect(() => {
        const getLocationItems = async (shareId: string, linkId: string): Promise<string[]> => {
            const { ParentLinkID, Name } = await getLinkMeta(shareId, linkId);
            if (!ParentLinkID) {
                return [c('Title').t`My files`];
            }

            const previous = await getLocationItems(shareId, ParentLinkID);
            return [...previous, Name];
        };

        getLocationItems(shareId, item.ParentLinkID)
            .then((items: string[]) => `\\${items.join('\\')}`)
            .then(setLocation);
    }, []);

    return (
        <div key="location" className="ellipsis">
            <span title={location}>{location}</span>
        </div>
    );
};

export default LocationCell;