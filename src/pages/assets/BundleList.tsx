import { ChevronRight } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type AssetBundle, type AssetSyncPending, BUNDLE_KINDS, type BundleKind, type BundleStatus, useBundles, useSyncPreview } from '#/api/bundles';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Badge, EmptyState, ErrorNotice, Loading, Select } from '#/components/ui';
import { cx } from '#/lib/cx';

import { BundleDetail } from './BundleDetail';
import { BundleIcon } from './BundleIcon';
import { formatBytes } from './format';

const STATUSES: { value: BundleStatus; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'ok', label: 'OK' },
    { value: 'failed', label: 'Failed' },
    { value: 'unused', label: 'Unused' },
];

/** What loads a bundle, in a few words: its effect ids, or its pet type. */
const idsOf = (bundle: AssetBundle) => {
    if (bundle.ids.length === 0)
        return null;

    if (bundle.kind === 'pet')
        return `type ${bundle.ids.join(', ')}`;

    const shown = bundle.ids.slice(0, 6).join(', ');

    return `${bundle.ids.length === 1 ? 'id' : 'ids'} ${shown}${bundle.ids.length > 6 ? ` +${bundle.ids.length - 6}` : ''}`;
};

/** The kinds whose list shows each bundle's revision and size; effects and pets are told apart by their ids alone. */
const SHOWS_FILE = new Set<BundleKind>([ 'furniture', 'figure' ]);

const BundleRow = ({ bundle, pending, showsFile, onOpen }: { bundle: AssetBundle; pending: AssetSyncPending | undefined; showsFile: boolean; onOpen: () => void }) => {
    const ids = idsOf(bundle);

    return (
        <li>
            <button
                type="button"
                onClick={onOpen}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-subtle/60 focus-visible:bg-subtle focus-visible:outline-none sm:px-4"
            >
                <BundleIcon kind={bundle.kind} name={bundle.name} ids={bundle.ids} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <span className={cx('truncate font-mono text-[13px] font-medium', !bundle.used && 'text-muted')}>{bundle.name}</span>
                        {bundle.source === 'upload' && <Badge tone="accent">upload</Badge>}
                        {bundle.error && <Badge tone="red">failed</Badge>}
                        {!bundle.used && <Badge tone="amber">unused</Badge>}
                        {pending && <Badge tone="accent">{pending.reason === 'updated' ? `Habbo has rev ${pending.habboRevision}` : 'Habbo has it'}</Badge>}
                    </span>
                    {bundle.error
                        ? <span className="truncate text-xs text-bad" title={bundle.error}>{bundle.error}</span>
                        : (
                                <span className="truncate font-mono text-[11px] text-muted">
                                    <span className="md:hidden">{(showsFile ? [ bundle.revision !== null ? `rev ${bundle.revision}` : null, ids, formatBytes(bundle.size) ] : [ ids ]).filter(Boolean).join(' · ')}</span>
                                    <span className="max-md:hidden">{ids ?? (bundle.source === 'upload' ? 'uploaded' : 'from Habbo')}</span>
                                </span>
                            )}
                </span>
                {showsFile && (
                    <>
                        <span className="hidden w-24 shrink-0 text-right font-mono text-xs text-muted tabular-nums md:block">{bundle.revision ?? '-'}</span>
                        <span className="hidden w-20 shrink-0 text-right font-mono text-xs text-muted tabular-nums md:block">{bundle.error ? '-' : formatBytes(bundle.size)}</span>
                    </>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
            </button>
        </li>
    );
};

/**
 * Every bundle of one kind, found by name or id and narrowed to the failed or unused ones; each
 * says when Habbo has a newer revision of it. A bundle opens to its files.
 */
export const BundleList = ({ kind, canManage }: { kind: BundleKind; canManage: boolean }) => {
    const [ params ] = useSearchParams();
    // A check's link opens the list narrowed as it says.
    const [ filter, setFilter ] = useState<BundleStatus>(() => STATUSES.find(x => x.value === params.get('status'))?.value ?? 'all');
    const [ text, setText ] = useState('');
    const q = useDeferredValue(text.trim());
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<{ kind: BundleKind; name: string } | null>(null);
    const { data, error, isFetching } = useBundles(kind, q, filter, page);
    const { data: preview } = useSyncPreview();
    const pending = new Map((preview?.kinds.find(x => x.kind === kind)?.items ?? []).map(x => [ x.name, x ]));
    const pageSize = data?.pageSize ?? 60;
    const one = BUNDLE_KINDS.find(x => x.value === kind)!.one;
    const showsFile = SHOWS_FILE.has(kind);

    return (
        <section className="overflow-clip rounded-xl border border-line bg-surface">
            <ListToolbar
                watch={[ kind, filter, q, page ]}
                page={{ offset: page * pageSize, limit: pageSize, total: data?.total, onChange: offset => setPage(Math.round(offset / pageSize)) }}
            >
                <SearchInput
                    value={text}
                    onValueChange={(value) => {
                        setText(value);
                        setPage(0);
                    }}
                    placeholder={kind === 'furniture' ? 'Find by name' : 'Find by name or id'}
                    className="w-full sm:w-56"
                />
                <Select
                    aria-label="Status"
                    value={filter}
                    onChange={(event) => {
                        setFilter(event.target.value as BundleStatus);
                        setPage(0);
                    }}
                    className="w-full sm:w-36"
                >
                    {STATUSES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                </Select>
            </ListToolbar>

            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {data && data.items.length === 0 && (
                <EmptyState>
                    {q ? `No ${one} bundle matches "${q}".` : filter === 'all' ? `There are no ${one} bundles yet. A sync from Habbo takes them, or upload your own.` : `No ${filter} ${one} bundles.`}
                </EmptyState>
            )}
            {data && data.items.length > 0 && (
                <>
                    <div className="hidden items-center gap-3 border-b border-line px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase md:flex">
                        <span className="w-10 shrink-0" />
                        <span className="flex-1">Bundle</span>
                        {showsFile && (
                            <>
                                <span className="w-24 shrink-0 text-right">Revision</span>
                                <span className="w-20 shrink-0 text-right">Size</span>
                            </>
                        )}
                        <span className="w-4 shrink-0" />
                    </div>
                    <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-70')}>
                        {data.items.map(bundle => (
                            <BundleRow key={`${bundle.kind}/${bundle.name}`} bundle={bundle} pending={pending.get(bundle.name)} showsFile={showsFile} onOpen={() => setOpen({ kind: bundle.kind, name: bundle.name })} />
                        ))}
                    </ul>
                </>
            )}

            <BundleDetail bundle={open} canManage={canManage} onClose={() => setOpen(null)} />
        </section>
    );
};
