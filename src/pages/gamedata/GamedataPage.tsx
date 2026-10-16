import { Upload } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { useAssetJob, useAssetsStatus, useSyncPreview } from '#/api/bundles';
import { useGamedataStatus } from '#/api/gamedata';
import { Button, ErrorNotice, Loading, PageBody, PageHeader } from '#/components/ui';
import { BundleKindTab } from '#/pages/assets/BundleKindTab';
import { JobPanel } from '#/pages/assets/JobPanel';
import { PublishTab } from '#/pages/assets/PublishTab';

import { ClientFiles } from './ClientFiles';
import { FiguresTab } from './FiguresTab';
import { FurnitureTab } from './FurnitureTab';
import { HistoryTab } from './HistoryTab';
import { ProductsTab } from './ProductsTab';
import { TextsTab } from './TextsTab';
import { UpdatesTab } from './UpdatesTab';
import { UploadDialog } from './UploadDialog';
import { VariablesTab } from './VariablesTab';

const TABS = [
    { value: 'updates', label: 'Updates' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'clothing', label: 'Clothing' },
    { value: 'effects', label: 'Effects' },
    { value: 'pets', label: 'Pets' },
    { value: 'products', label: 'Products' },
    { value: 'texts', label: 'Texts' },
    { value: 'variables', label: 'Variables' },
    { value: 'publish', label: 'Publish' },
    { value: 'history', label: 'History' },
];

/** The tabs the page had before it took the assets in, by the names links still use. */
const RENAMED: Record<string, string> = { overview: 'updates', figures: 'clothing' };

/**
 * The hotel's gamedata and the asset bundles the client draws from, as one: the files the client
 * loads are built from the database, the bundles kept on this server, and both take Habbo's
 * releases in after a look at what they change, keeping the hotel's own edits. The Updates tab
 * holds everything waiting from Habbo; each kind of thing (furniture, clothing, effects, pets) has
 * a tab of its data and its bundles together, with what waits for it at the top. One upload takes
 * any file and finds what it is.
 */
export const GamedataPage = () => {
    const [ params, setParams ] = useSearchParams();
    const asked = RENAMED[params.get('tab') ?? ''] ?? params.get('tab');
    const tab = TABS.some(x => x.value === asked) ? asked! : 'updates';
    const { data: status, error } = useGamedataStatus();
    const { data: assets, error: assetsError } = useAssetsStatus();
    const { data: job } = useAssetJob();
    const { data: pending } = useSyncPreview(!!assets);
    const [ uploading, setUploading ] = useState(false);
    const running = job?.status === 'running';
    const canManage = !!status?.canManage && !!assets?.canManage;
    const waitingBundles = pending?.kinds.reduce((sum, x) => sum + x.new + x.updated, 0);
    // A tab opened again from the search or a link, with something else found, starts over with it.
    const found = [ 'q', 'id', 'open', 'tag', 'status', 'view' ].map(x => params.get(x)).join('|');

    return (
        <>
            <PageHeader
                title="Gamedata & assets"
                description="What the client loads: furnidata, product data, texts, figure data and variables built from the database, and the bundles it draws from"
                tabs={{
                    items: TABS.map(x => (x.value === 'updates' && waitingBundles ? { ...x, count: waitingBundles } : x)),
                    value: tab,
                    onChange: value => setParams({ tab: value }, { replace: true }),
                }}
            >
                {canManage && <Button icon={<Upload />} onClick={() => setUploading(true)}>Upload</Button>}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {assetsError && <ErrorNotice error={assetsError} />}
                {(!status || !assets) && !error && !assetsError && <Loading />}
                {status && assets && (
                    <>
                        {/* A running job anywhere; on Publish, the last publish however it ended, so one that failed says why. */}
                        {job && tab !== 'updates' && (running || (tab === 'publish' && job.kind === 'publish')) && <JobPanel job={job} canManage={assets.canManage} compact={running} />}
                        {tab === 'updates' && <UpdatesTab status={status} assets={assets} />}
                        {tab === 'furniture' && <FurnitureTab key={found} status={status} />}
                        {tab === 'clothing' && <FiguresTab key={found} status={status} />}
                        {tab === 'effects' && <BundleKindTab key={found} kind="effect" canManage={assets.canManage} />}
                        {tab === 'pets' && <BundleKindTab key={found} kind="pet" canManage={assets.canManage} />}
                        {tab === 'products' && <ProductsTab key={found} status={status} />}
                        {tab === 'texts' && <TextsTab key={found} status={status} />}
                        {tab === 'variables' && <VariablesTab key={found} status={status} />}
                        {tab === 'publish' && (
                            <>
                                <ClientFiles status={status} />
                                <PublishTab canManage={assets.canManage} busy={running} />
                            </>
                        )}
                        {tab === 'history' && <HistoryTab canManage={status.canManage} />}
                    </>
                )}
            </PageBody>
            <UploadDialog open={uploading} onClose={() => setUploading(false)} />
        </>
    );
};

/** The Assets page's old addresses, to where its parts now are. */
export const AssetsRedirect = () => {
    const [ params ] = useSearchParams();
    const kind = params.get('kind');
    const status = params.get('status');
    const tab = params.get('tab');
    const to = new URLSearchParams();

    if (tab === 'publish') {
        to.set('tab', 'publish');
    } else if (tab === 'bundles') {
        to.set('tab', kind === 'figure' ? 'clothing' : kind === 'effect' ? 'effects' : kind === 'pet' ? 'pets' : 'furniture');

        if (kind === 'figure')
            to.set('view', 'bundles');

        if (status)
            to.set('status', status);
    } else {
        to.set('tab', 'updates');
    }

    return <Navigate to={`/gamedata?${to}`} replace />;
};
