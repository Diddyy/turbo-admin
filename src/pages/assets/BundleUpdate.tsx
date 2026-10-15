import { ChevronDown, ChevronRight, CloudDownload } from 'lucide-react';
import { useState } from 'react';

import { type AssetSyncPending, BUNDLE_KINDS, type BundleKind, useAssetJob, useStartSync, useSyncPreview } from '#/api/bundles';
import { ask } from '#/components/confirm';
import { toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, Loading, Panel, WarningNotice } from '#/components/ui';
import { fromNow } from '#/lib/time';

/** Starts a sync from Habbo, after saying what it takes. */
export const SyncButton = ({ pending, variant = 'primary' }: { pending?: number; variant?: 'primary' | 'secondary' }) => {
    const sync = useStartSync();
    const { data: job } = useAssetJob();
    const running = job?.status === 'running';

    return (
        <Button
            variant={variant}
            icon={<CloudDownload />}
            disabled={running || sync.isPending}
            onClick={() => ask(
                {
                    title: 'Sync the bundles from Habbo?',
                    body: pending !== undefined && pending > 0
                        ? `${pending.toLocaleString()} libraries the hotel lacks, or has an older revision of, are downloaded and converted. Uploads are never replaced.`
                        : 'Every library Habbo has that the hotel lacks, or has an older revision of, is downloaded and converted. The first sync takes the whole hotel: about 14,000 furniture libraries and several GB.',
                    confirm: 'Sync',
                },
                () => sync.mutate(undefined, { onError: toastError }),
            )}
        >
            {running ? 'Syncing' : 'Sync'}
        </Button>
    );
};

/** One library a sync would take: new to the hotel, or at a newer revision than the hotel's. */
export const PendingRow = ({ item }: { item: AssetSyncPending }) => (
    <li className="grid gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[5.5rem_minmax(10rem,1fr)_2fr]">
        <span><Badge tone={item.reason === 'new' ? 'green' : 'accent'}>{item.reason}</Badge></span>
        <span className="min-w-0 truncate font-mono text-xs" title={item.name}>{item.name}</span>
        <span className="min-w-0 font-mono text-xs text-muted">
            {item.reason === 'updated'
                ? <>rev {item.hotelRevision} → <span className="text-ink">{item.habboRevision}</span></>
                : `rev ${item.habboRevision}`}
            {item.error && <span className="block truncate text-warn" title={item.error}>{`tried before: ${item.error}`}</span>}
        </span>
    </li>
);

/**
 * Habbo's libraries of one kind, in a bar like the gamedata's: whether the hotel has them all at
 * Habbo's revisions, what a sync would download, the list to look over, and syncing. Every kind's
 * tab heads with one, so bundles read the same way as the data.
 */
export const BundleUpdate = ({ kind, canManage, defaultOpen = false }: { kind: BundleKind; canManage: boolean; defaultOpen?: boolean }) => {
    const [ open, setOpen ] = useState(defaultOpen);
    const { data: preview, error } = useSyncPreview();
    const entry = preview?.kinds.find(x => x.kind === kind);
    const one = BUNDLE_KINDS.find(x => x.value === kind)!.one;
    const pending = entry ? entry.new + entry.updated : 0;
    const upToDate = entry !== undefined && entry.listed && pending === 0;

    return (
        <Panel>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-[1_1_16rem]">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[13px] font-semibold tracking-wide">Habbo's {one} bundles</h2>
                        {!preview && !error && <Badge>checking</Badge>}
                        {error !== null && error !== undefined && <Badge tone="red">can't read Habbo</Badge>}
                        {entry && !entry.listed && <Badge tone="amber">list unreadable</Badge>}
                        {upToDate && <Badge tone="green">up to date</Badge>}
                        {pending > 0 && <Badge tone="amber">{`${pending.toLocaleString()} to download`}</Badge>}
                    </div>
                    {preview && entry && (
                        <div className="mt-0.5 truncate font-mono text-[11px] text-muted">
                            {preview.revision.replace(/^PRODUCTION-/, '')} · {entry.habboLibraries.toLocaleString()} libraries · {entry.upToDate.toLocaleString()} up to date
                            {entry.uploads > 0 && ` · ${entry.uploads.toLocaleString()} uploads kept`} · listed {fromNow(preview.listedAt)}
                        </div>
                    )}
                </div>
                {pending > 0 && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted tabular-nums">
                        <span><span className="text-good">+{entry!.new.toLocaleString()}</span> new</span>
                        <span><span className="text-accent">{entry!.updated.toLocaleString()}</span> updated</span>
                    </div>
                )}
                <div className="flex items-center gap-2">
                    {pending > 0 && (
                        <Button variant="ghost" icon={open ? <ChevronDown /> : <ChevronRight />} onClick={() => setOpen(!open)}>
                            Review
                        </Button>
                    )}
                    {canManage && pending > 0 && <SyncButton pending={preview!.kinds.reduce((sum, x) => sum + x.new + x.updated, 0)} />}
                </div>
            </div>
            {error !== null && error !== undefined && <div className="border-t border-line p-4"><ErrorNotice error={error} /></div>}
            {open && entry && pending > 0 && (
                <div className="border-t border-line">
                    {entry.truncated && <div className="p-3"><WarningNotice>Only the first {entry.items.length.toLocaleString()} of {pending.toLocaleString()} are listed.</WarningNotice></div>}
                    <ul className="max-h-96 divide-y divide-line overflow-y-auto text-sm">{entry.items.map(item => <PendingRow key={item.name} item={item} />)}</ul>
                </div>
            )}
            {!preview && !error && <div className="border-t border-line"><Loading /></div>}
        </Panel>
    );
};
