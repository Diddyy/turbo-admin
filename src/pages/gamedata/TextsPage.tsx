import { History, Plus } from 'lucide-react';
import { useState } from 'react';

import type { HistoryScope } from '#/api/gamedata';
import { Button, PageBody, PageHeader } from '#/components/ui';
import { usePathTab } from '#/lib/tabs';

import { Loaded } from './frame';
import { HistoryModal } from './HistoryPanel';
import { ProductsTab } from './ProductsTab';
import { useFoundKey, useGamedata } from './state';
import { TextsTab } from './TextsTab';
import { VariablesTab } from './VariablesTab';

/** Each file the client reads, a tab at `/gamedata/<file>`. */
const TEXT_TABS = [
    { value: 'products', label: 'Products', to: '/gamedata/products' },
    { value: 'texts', label: 'Texts', to: '/gamedata/texts' },
    { value: 'variables', label: 'Variables', to: '/gamedata/variables' },
];

/**
 * The words and settings the client reads: the product data (a catalog offer's name and
 * description), the external texts, and the external variables that configure the client.
 */
export const TextsPage = () => {
    const state = useGamedata();
    const [ tab, toTab ] = usePathTab(TEXT_TABS.map(x => x.value));
    const found = useFoundKey();
    const [ history, setHistory ] = useState(false);
    // The tab whose new entry is being written, in a dialog over the list.
    const [ adding, setAdding ] = useState<string | null>(null);
    const noun = { products: 'product', texts: 'text', variables: 'variable' }[tab];

    if (toTab)
        return toTab;

    return (
        <>
            <PageHeader
                title="Texts & variables"
                description="The product data, external texts and external variables the client reads"
                tabs={{ items: TEXT_TABS, value: tab }}
            >
                <Button variant="secondary" icon={<History />} onClick={() => setHistory(true)}>History</Button>
                {state.canManage && <Button icon={<Plus />} onClick={() => setAdding(tab)}>New {noun}</Button>}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <Loaded state={state}>
                    {status => (
                        <>
                            {tab === 'products' && <ProductsTab key={found} status={status} adding={adding === tab} onAdded={() => setAdding(null)} />}
                            {tab === 'texts' && <TextsTab key={found} status={status} adding={adding === tab} onAdded={() => setAdding(null)} />}
                            {tab === 'variables' && <VariablesTab key={found} status={status} adding={adding === tab} onAdded={() => setAdding(null)} />}
                        </>
                    )}
                </Loaded>
            </PageBody>
            <HistoryModal scope={tab as HistoryScope} canManage={state.canManage} open={history} onClose={() => setHistory(false)} />
        </>
    );
};
