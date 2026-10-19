import { Upload } from 'lucide-react';
import { useState } from 'react';

import { Button, PageBody, PageHeader } from '#/components/ui';
import { BundleKindTab } from '#/pages/assets/BundleKindTab';

import { FiguresTab } from './FiguresTab';
import { Loaded, RunningJob } from './frame';
import { FurnitureTab } from './FurnitureTab';
import { useFoundKey, useGamedata, useTab } from './state';
import { UploadDialog } from './UploadDialog';

const TABS = [
    { value: 'furniture', label: 'Furniture' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'effects', label: 'Effects' },
    { value: 'pets', label: 'Pets' },
].map(x => ({ ...x, to: `/gamedata/library/${x.value}` }));

/**
 * The library: what the hotel's rooms and avatars are drawn from, each kind in a tab with its data
 * and its bundles together - furniture, clothing (and its colours), effects and pets. What Habbo has
 * waiting for a kind is a line at the top, reviewed and taken in on Habbo updates. One upload
 * takes any file and finds what it is.
 */
export const LibraryPage = () => {
    const state = useGamedata();
    const tab = useTab(TABS.map(x => x.value));
    const found = useFoundKey();
    const [ uploading, setUploading ] = useState(false);

    return (
        <>
            <PageHeader
                title="Library"
                description="Furniture, clothing, effects and pets: their data and the bundles they're drawn from"
                tabs={{ items: TABS, value: tab }}
            >
                {state.canManage && <Button icon={<Upload />} onClick={() => setUploading(true)}>Upload</Button>}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <Loaded state={state}>
                    {(status, assets) => (
                        <>
                            <RunningJob canManage={assets.canManage} />
                            {tab === 'furniture' && <FurnitureTab key={found} status={status} />}
                            {tab === 'clothing' && <FiguresTab key={found} status={status} />}
                            {tab === 'effects' && <BundleKindTab key={found} kind="effect" status={status} canManage={assets.canManage} />}
                            {tab === 'pets' && <BundleKindTab key={found} kind="pet" status={status} canManage={assets.canManage} />}
                        </>
                    )}
                </Loaded>
            </PageBody>
            <UploadDialog open={uploading} onClose={() => setUploading(false)} />
        </>
    );
};
