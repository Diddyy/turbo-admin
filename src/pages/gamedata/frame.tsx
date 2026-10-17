import { ArrowRight, CloudDownload } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { type AssetsStatus, BUNDLE_KINDS, type BundleKind, useAssetJob, useSyncPreview } from '#/api/bundles';
import { type GamedataStatus, useFigureImportPreview, useImportPreview, useProductImportPreview, useTextImportPreview } from '#/api/gamedata';
import { ErrorNotice, Loading } from '#/components/ui';
import { plural } from '#/lib/plural';
import { JobPanel } from '#/pages/assets/JobPanel';

import type { useGamedata } from './state';

/** A page's body once the gamedata and the assets are both read: until then, loading or why not. */
export const Loaded = ({ state, children }: { state: ReturnType<typeof useGamedata>; children: (status: GamedataStatus, assets: AssetsStatus) => ReactNode }) => {
    if (state.error)
        return <ErrorNotice error={state.error} />;

    if (!state.status || !state.assets)
        return <Loading />;

    return children(state.status, state.assets);
};

/** A sync, a publish or a build running, folded small, above a page that isn't about it. */
export const RunningJob = ({ canManage }: { canManage: boolean }) => {
    const { data: job } = useAssetJob();

    return job?.status === 'running' ? <JobPanel job={job} canManage={canManage} compact /> : null;
};

type DataKind = 'furniture' | 'figures' | 'products' | 'texts';

const DATA_WORDS: Record<DataKind, string> = { furniture: 'furniture', figures: 'clothing', products: 'product', texts: 'text' };

/**
 * What Habbo has of this tab's kind that the hotel hasn't taken in, in one line with a way to the
 * Habbo updates page where it is reviewed and taken in. Nothing when there's nothing waiting.
 */
export const WaitingFromHabbo = ({ status, data, bundles }: { status: GamedataStatus; data?: DataKind; bundles?: BundleKind }) => {
    const furniture = useImportPreview(data === 'furniture' && status.latestRelease !== null);
    const figures = useFigureImportPreview(data === 'figures' && status.latestFigures !== null);
    const products = useProductImportPreview(data === 'products' && status.latestProducts !== null);
    const texts = useTextImportPreview(data === 'texts' && status.latestTexts !== null);
    const pending = useSyncPreview(bundles !== undefined);
    const preview = data && { furniture, figures, products, texts }[data].data;
    const changes = preview ? preview.added + preview.updated + preview.kept : 0;
    const entry = bundles && pending.data?.kinds.find(x => x.kind === bundles);
    const toDownload = entry?.listed ? entry.new + entry.updated : 0;

    if (changes === 0 && toDownload === 0)
        return null;

    const one = BUNDLE_KINDS.find(x => x.value === bundles)?.one;
    const parts = [
        changes > 0 ? plural(changes, `${DATA_WORDS[data!]} change`, `${DATA_WORDS[data!]} changes`) : null,
        toDownload > 0 ? plural(toDownload, `${one} bundle`, `${one} bundles`) : null,
    ].filter(Boolean);
    const pick = changes > 0 ? data : `${bundles}-bundles`;

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-accent/30 bg-accent-soft/60 px-4 py-2.5">
            <CloudDownload className="size-4 shrink-0 text-accent" aria-hidden />
            <p className="min-w-0 flex-1 text-sm">
                Habbo has <span className="font-semibold">{parts.join(' and ')}</span> the hotel hasn't taken in.
            </p>
            <Link to={`/gamedata?pick=${pick}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-accent hover:underline [&>svg]:size-4">
                Review <ArrowRight />
            </Link>
        </div>
    );
};
