import { History, Upload } from 'lucide-react';
import { useState } from 'react';

import type { HistoryScope } from '#/api/gamedata';
import { Button, PageBody, PageHeader } from '#/components/ui';

import { Loaded } from './frame';
import { HistoryModal } from './HistoryPanel';
import { ProductsTab } from './ProductsTab';
import { useFoundKey, useGamedata, useTab } from './state';
import { TextsTab } from './TextsTab';
import { UploadDialog } from './UploadDialog';
import { VariablesTab } from './VariablesTab';

const TABS = [
    { value: 'products', label: 'Products' },
    { value: 'texts', label: 'Texts' },
    { value: 'variables', label: 'Variables' },
];

/**
 * The words and settings the client reads: the product data (a catalog offer's name and
 * description), the external texts, and the external variables that configure the client.
 */
export const TextsPage = () => {
    const state = useGamedata();
    const [ tab, setTab ] = useTab(TABS.map(x => x.value));
    const found = useFoundKey();
    const [ uploading, setUploading ] = useState(false);
    const [ history, setHistory ] = useState(false);

    return (
        <>
            <PageHeader
                title="Texts & variables"
                description="The product data, external texts and external variables the client reads"
                tabs={{ items: TABS, value: tab, onChange: setTab }}
            >
                <Button variant="secondary" icon={<History />} onClick={() => setHistory(true)}>History</Button>
                {state.canManage && <Button icon={<Upload />} onClick={() => setUploading(true)}>Upload</Button>}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <Loaded state={state}>
                    {status => (
                        <>
                            {tab === 'products' && <ProductsTab key={found} status={status} />}
                            {tab === 'texts' && <TextsTab key={found} status={status} />}
                            {tab === 'variables' && <VariablesTab key={found} status={status} />}
                        </>
                    )}
                </Loaded>
            </PageBody>
            <UploadDialog open={uploading} onClose={() => setUploading(false)} />
            <HistoryModal scope={tab as HistoryScope} canManage={state.canManage} open={history} onClose={() => setHistory(false)} />
        </>
    );
};
