import { ChevronDown, ExternalLink, FlaskConical, GitCompare, History, KeyRound, Pencil, Plug, Plus, Send, Trash2 } from 'lucide-react';
import { useDeferredValue, useState } from 'react';

import { type AssetPublishEntry, type AssetTarget, DEFAULT_PORTS, PROTOCOLS, useDeleteTarget, useForgetHostKey, usePublish, useTargetHistory, useTargetPending, useTargets, useTestTarget } from '#/api/bundles';
import { ask } from '#/components/confirm';
import { Modal } from '#/components/Modal';
import { Pagination } from '#/components/Pagination';
import { SearchInput } from '#/components/SearchInput';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Loading, Panel, SuccessNotice, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';

import { CompareModal } from './CompareModal';
import { formatBytes, formatTime } from './format';
import { TargetForm } from './TargetForm';

/** Where a target sends to, as one line: a folder's path, or the server, its port and its folder. */
const addressOf = (target: AssetTarget) => {
    if (target.protocol === 'folder')
        return target.remotePath || '-';

    const port = target.port || DEFAULT_PORTS[target.protocol];
    const user = target.user ? `${target.user}@` : '';

    return `${user}${target.host}:${port}${target.remotePath.startsWith('/') ? '' : '/'}${target.remotePath}`;
};

/** What a publish did, in a line; with how many addresses Cloudflare purged after it, when any were. */
const counts = (entry: AssetPublishEntry) =>
    `${entry.uploaded.toLocaleString()} sent, ${entry.skipped.toLocaleString()} skipped, ${entry.deleted.toLocaleString()} deleted, ${formatBytes(entry.bytes)}${entry.purged > 0 ? `, ${entry.purged.toLocaleString()} purged from Cloudflare` : ''}`;

const HistoryModal = ({ target, onClose }: { target: AssetTarget | null; onClose: () => void }) => {
    const { data, error } = useTargetHistory(target?.id ?? null);

    return (
        <Modal open={!!target} onClose={onClose} title={target ? `${target.name}: publishes` : ''} className="sm:h-fit! sm:max-w-2xl">
            {error && <div className="p-5"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {data && data.items.length === 0 && <EmptyState>Nothing has been published to it yet.</EmptyState>}
            {data && data.items.length > 0 && (
                <ul className="divide-y divide-line">
                    {data.items.map(entry => (
                        <li key={entry.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium" title={formatTime(entry.startedAt)}>{fromNow(entry.startedAt)}</span>
                                {entry.playerName && <span className="text-muted">by {entry.playerName}</span>}
                                {entry.dryRun && <Badge>dry run</Badge>}
                                {entry.error ? <Badge tone="red">failed</Badge> : !entry.finishedAt && <Badge tone="accent">running</Badge>}
                            </div>
                            <span className="font-mono text-xs text-muted">{counts(entry)}</span>
                            {entry.error && <span className="text-xs text-bad">{entry.error}</span>}
                            {entry.purgeError && <span className="text-xs text-warn">{`Cloudflare purge failed: ${entry.purgeError}`}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
};

/**
 * What a target lacks or holds an older copy of, as a publish would send it (largest first): each
 * file's path, size and why, found by its path, with the totals of all of it.
 */
const PendingList = ({ target }: { target: AssetTarget }) => {
    const [ text, setText ] = useState('');
    const [ page, setPage ] = useState(0);
    // The file compared, '' for every changed one; null while none is.
    const [ comparing, setComparing ] = useState<string | null>(null);
    const q = useDeferredValue(text.trim());
    const { data, error } = useTargetPending(target.id, q, page);

    return (
        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
            {error && <ErrorNotice error={error} />}
            {!data && !error && <Loading />}
            {data && (
                <>
                    <div className="flex items-center gap-2">
                        <p className="min-w-0 flex-1 text-xs text-muted">
                            {`${data.count.toLocaleString()} ${data.count === 1 ? 'file' : 'files'}, ${formatBytes(data.bytes)}: ${data.new.toLocaleString()} never sent, ${data.changed.toLocaleString()} changed since sent`}
                        </p>
                        {data.changed > 0 && (
                            <Button variant="ghost" icon={<GitCompare />} className="h-8 shrink-0 px-2 text-xs sm:h-7" onClick={() => setComparing('')}>
                                Compare all
                            </Button>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <SearchInput
                            placeholder="Find by path"
                            value={text}
                            onValueChange={(value) => {
                                setText(value);
                                setPage(0);
                            }}
                            className="min-w-0 flex-1"
                        />
                        <Pagination offset={page * data.pageSize} limit={data.pageSize} total={data.matched} onChange={offset => setPage(Math.floor(offset / data.pageSize))} />
                    </div>
                    {data.items.length === 0
                        ? <p className="py-2 text-center text-xs text-muted">{data.count === 0 ? 'Nothing is pending: it is up to date.' : `No pending path holds "${q}".`}</p>
                        : (
                                <ul aria-label={`${target.name}: pending`} className="max-h-72 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                                    {data.items.map(file => (
                                        <li key={file.path} className="flex items-center gap-2 px-2.5 py-1.5 text-xs">
                                            <Badge tone={file.change === 'new' ? 'accent' : 'amber'}>{file.change}</Badge>
                                            <span className="min-w-0 flex-1 truncate font-mono" title={file.path}>{file.path}</span>
                                            <span className="shrink-0 text-muted tabular-nums">{formatBytes(file.size)}</span>
                                            {file.change === 'changed' && (
                                                <IconButton small label={`Compare ${file.path}`} icon={<GitCompare />} onClick={() => setComparing(file.path)} />
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            )}
                </>
            )}
            <CompareModal target={target} path={comparing} onClose={() => setComparing(null)} />
        </div>
    );
};

const TargetCard = ({ target, canManage, busy, onEdit, onHistory }: { target: AssetTarget; canManage: boolean; busy: boolean; onEdit: () => void; onHistory: () => void }) => {
    const [ deleteRemoved, setDeleteRemoved ] = useState(false);
    const [ showPending, setShowPending ] = useState(false);
    const test = useTestTarget();
    const publish = usePublish();
    const remove = useDeleteTarget();
    const forget = useForgetHostKey();
    const last = target.lastPublish;
    const protocol = PROTOCOLS.find(x => x.value === target.protocol)?.label ?? target.protocol;

    const start = (dryRun: boolean) => publish.mutate({ id: target.id, dryRun, deleteRemoved }, { onError: toastError });

    return (
        <section className="flex min-w-0 flex-col rounded-xl border border-line bg-surface">
            <header className="flex items-start gap-3 border-b border-line px-4 py-3">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-sm font-semibold">{target.name}</h2>
                        <Badge tone="accent">{protocol}</Badge>
                        {target.pending > 0
                            ? (
                                    <button
                                        type="button"
                                        title="What's pending"
                                        aria-expanded={showPending}
                                        onClick={() => setShowPending(!showPending)}
                                        className="rounded-md transition hover:brightness-95 active:scale-[0.97]"
                                    >
                                        <Badge tone="amber">
                                            {`${target.pending.toLocaleString()} pending`}
                                            <ChevronDown className={cx('size-3 transition-transform', showPending && 'rotate-180')} />
                                        </Badge>
                                    </button>
                                )
                            : <Badge tone="green">up to date</Badge>}
                    </div>
                    <p className="mt-1 truncate font-mono text-xs text-muted" title={addressOf(target)}>{addressOf(target)}</p>
                </div>
                <div className="-mr-1.5 -mt-1 flex shrink-0 items-center">
                    <IconButton label="History" icon={<History />} onClick={onHistory} />
                    {canManage && <IconButton label="Edit" icon={<Pencil />} onClick={onEdit} />}
                    {canManage && (
                        <IconButton
                            label="Delete"
                            tone="bad"
                            icon={<Trash2 />}
                            disabled={remove.isPending}
                            onClick={() => ask(
                                `Delete the target ${target.name}? What it records as sent and its history go with it. Nothing on the server itself is deleted.`,
                                () => remove.mutate(target.id, { onSuccess: () => toast(`Deleted ${target.name}.`), onError: toastError }),
                            )}
                        />
                    )}
                </div>
            </header>

            <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-2 px-4 py-3 text-[13px] sm:grid-cols-[7rem_minmax(0,1fr)]">
                <dt className="text-muted">Public URL</dt>
                <dd className="min-w-0 truncate font-mono text-xs max-sm:-mt-1.5">
                    {target.publicUrl
                        ? (
                                <a href={target.publicUrl} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-accent hover:underline">
                                    <span className="truncate">{target.publicUrl}</span>
                                    <ExternalLink className="size-3 shrink-0" />
                                </a>
                            )
                        : '-'}
                </dd>
                <dt className="text-muted">Last publish</dt>
                <dd className="min-w-0 max-sm:-mt-1.5">
                    {last
                        ? (
                                <span className="flex flex-col gap-0.5">
                                    <span className="flex flex-wrap items-center gap-1.5">
                                        <span title={formatTime(last.startedAt)}>{fromNow(last.startedAt)}</span>
                                        {last.playerName && <span className="text-muted">by {last.playerName}</span>}
                                        {last.dryRun && <Badge>dry run</Badge>}
                                    </span>
                                    <span className="font-mono text-xs text-muted">{counts(last)}</span>
                                    {last.error && <span className="text-xs text-bad">{last.error}</span>}
                                    {last.purgeError && <span className="text-xs text-warn">{`Cloudflare purge failed: ${last.purgeError}`}</span>}
                                </span>
                            )
                        : <span className="text-muted">Never</span>}
                </dd>
                <dt className="text-muted">Cloudflare</dt>
                <dd className="min-w-0 truncate font-mono text-xs max-sm:-mt-1.5">
                    {target.cloudflareZoneId
                        ? (target.hasCloudflareToken ? `purges zone ${target.cloudflareZoneId}` : <span className="text-warn">{`zone ${target.cloudflareZoneId}, no token: nothing is purged`}</span>)
                        : <span className="font-sans text-muted">not purged</span>}
                </dd>
                {target.protocol === 'sftp' && (
                    <>
                        <dt className="text-muted">Host key</dt>
                        <dd className="flex min-w-0 items-center gap-2 max-sm:-mt-1.5">
                            <span className="min-w-0 truncate font-mono text-xs" title={target.hostKey ?? undefined}>{target.hostKey ?? <span className="text-muted">trusted on first connection</span>}</span>
                            {target.hostKey && canManage && (
                                <Button
                                    variant="ghost"
                                    icon={<KeyRound />}
                                    className="h-8 shrink-0 px-2 text-xs sm:h-7"
                                    disabled={forget.isPending}
                                    onClick={() => ask(
                                        `Forget the host key of ${target.name}? The next connection trusts whatever key the server shows. Do it only when you know the server's key changed.`,
                                        () => forget.mutate(target.id, { onSuccess: () => toast('Forgot the host key.'), onError: toastError }),
                                    )}
                                >
                                    Forget
                                </Button>
                            )}
                        </dd>
                    </>
                )}
            </dl>

            {showPending && target.pending > 0 && <PendingList target={target} />}

            {(test.data || test.error) && (
                <div className="px-4 pb-3">
                    {test.error && <ErrorNotice error={test.error} />}
                    {test.data && (test.data.ok ? <SuccessNotice>{test.data.message}</SuccessNotice> : <ErrorNotice error={new Error(test.data.message)} />)}
                </div>
            )}

            {canManage && (
                <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
                    <Button variant="secondary" icon={<Plug />} disabled={test.isPending} onClick={() => test.mutate(target.id)}>
                        {test.isPending ? 'Testing' : 'Test'}
                    </Button>
                    <Button variant="secondary" icon={<FlaskConical />} disabled={busy || publish.isPending} onClick={() => start(true)}>Dry run</Button>
                    <Switch
                        label="Delete removed"
                        checked={deleteRemoved}
                        onChange={setDeleteRemoved}
                        className="ml-auto min-h-9 gap-2.5 text-muted max-sm:order-last max-sm:w-full"
                    />
                    <Button
                        icon={<Send />}
                        disabled={busy || publish.isPending}
                        className={cx('max-sm:flex-1')}
                        onClick={() => ask(
                            {
                                title: `Publish to ${target.name}?`,
                                body: `${target.pending > 0 ? `${target.pending.toLocaleString()} bundles it lacks or holds an older copy of are sent.` : 'It looks up to date; only what changed is sent.'} ${deleteRemoved ? 'What the hotel no longer has is deleted from it.' : 'Nothing is deleted from it.'}`,
                                confirm: 'Publish',
                                danger: deleteRemoved,
                            },
                            () => start(false),
                        )}
                    >
                        Publish
                    </Button>
                </footer>
            )}
        </section>
    );
};

/**
 * Where the bundles go: each target, how far behind it is and its last publish, and, for staff who
 * manage the assets, testing, publishing (a dry run only counts) and editing them.
 */
export const PublishTab = ({ canManage, busy }: { canManage: boolean; busy: boolean }) => {
    const { data, error } = useTargets();
    const [ editing, setEditing ] = useState<AssetTarget | 'new' | null>(null);
    const [ history, setHistory ] = useState<AssetTarget | null>(null);

    return (
        <>
            <Panel
                title="Publish targets"
                description="A publish sends only what a target lacks or holds an older copy of, largest first, and picks up where it stopped."
                actions={canManage && <Button icon={<Plus />} onClick={() => setEditing('new')}>Add target</Button>}
            >
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!data && !error && <Loading />}
                {data && data.items.length === 0 && <EmptyState>No targets yet. Add the folder or the server your client loads its bundles from.</EmptyState>}
                {data && data.items.length > 0 && (
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:p-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
                        {data.items.map(target => (
                            <TargetCard key={target.id} target={target} canManage={canManage} busy={busy} onEdit={() => setEditing(target)} onHistory={() => setHistory(target)} />
                        ))}
                    </div>
                )}
            </Panel>

            {editing && <TargetForm target={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
            <HistoryModal target={history} onClose={() => setHistory(null)} />
        </>
    );
};
