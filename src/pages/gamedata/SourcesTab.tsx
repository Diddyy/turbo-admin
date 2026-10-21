import { ChevronDown, Database, Hammer, Library, MonitorDown, RefreshCw, Wind } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link } from 'react-router';

import { type AssetsStatus, type AssetSyncPreview, type HabboClientBuild, useAssetJob, useHabboClientBuild, useRelist, useStartClientBuild, useSyncPreview } from '#/api/bundles';
import { type GamedataStatus, type HabboAirClient, type HabboClientEnvironment, type HabboClientStatus, useCheckHabboClient, useHabboClient } from '#/api/gamedata';
import { toastError } from '#/components/toast';
import { Badge, type BadgeTone, Button, ErrorNotice, Loading, Panel, Th } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { SyncButton } from '#/pages/assets/BundleUpdate';

import { HabboClientDetails } from './HabboClientDetails';
import { type Category, LIBRARY_CATEGORIES, waitingLink } from './updates';

/** How a source stands, as its badge says it. */
interface Status {
    label: string;
    tone: BadgeTone;
    title?: string;
}

/** A version of one of Habbo's gamedata files, as the hotel keeps it. */
interface FileVersion {
    habboHash?: string | null;
    foundAt: string;
    checkedAt: string;
    importedAt: string | null;
}

/** One of the files Habbo's /gamedata/hashes lists, and the hotel's latest version of it. */
interface GamedataFile {
    id: string;
    label: string;
    /** Its name in Habbo's hashes. */
    name: string;
    version: FileVersion | null;
    count: string | null;
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const revision = (value: string) => value.replace(/^PRODUCTION-/, '');

/** The latest of some moments; null when there are none. */
const latest = (moments: (string | null | undefined)[]) =>
    moments.reduce<string | null>((best, x) => (x && (!best || Date.parse(x) > Date.parse(best)) ? x : best), null);

/** The files Habbo's /gamedata/hashes lists, each with what the hotel has of it. */
const gamedataFiles = (status: GamedataStatus): GamedataFile[] => {
    const figures = status.latestFigures;
    const count = (value: number | undefined, unit: string) => (value === undefined ? null : `${value.toLocaleString()} ${unit}`);

    return [
        { id: 'furniture', label: 'Furniture', name: 'furnidata', version: status.latestRelease, count: count(status.latestRelease?.furnitureCount, 'items') },
        { id: 'products', label: 'Products', name: 'productdata', version: status.latestProducts, count: count(status.latestProducts?.productCount, 'products') },
        { id: 'texts', label: 'Texts', name: 'external_texts', version: status.latestTexts, count: count(status.latestTexts?.textCount, 'texts') },
        { id: 'variables', label: 'Variables', name: 'external_variables', version: status.latestVariables ?? null, count: count(status.latestVariables?.variableCount, 'variables') },
        { id: 'figures', label: 'Clothing', name: 'figurepartlist', version: figures, count: figures ? `${figures.setCount.toLocaleString()} pieces · ${figures.colorCount.toLocaleString()} colours` : null },
    ];
};

/** A file whose latest hash the hotel hasn't taken in: Habbo changed it since. */
const hashChanged = (file: GamedataFile) => !!file.version && !file.version.importedAt;

const gamedataStatus = (files: GamedataFile[]): Status => {
    if (files.every(x => !x.version))
        return { label: 'not checked', tone: 'neutral' };

    const changed = files.filter(hashChanged).length;

    return changed > 0
        ? { label: `${changed} new ${changed === 1 ? 'hash' : 'hashes'}`, tone: 'amber', title: 'Habbo lists a hash for these files that the hotel hasn\'t taken in.' }
        : { label: 'up to date', tone: 'green' };
};

const libraryStatus = (preview: AssetSyncPreview | undefined, error: unknown): Status => {
    if (error)
        return { label: 'can\'t read Habbo', tone: 'red', title: error instanceof Error ? error.message : undefined };

    if (!preview)
        return { label: 'reading', tone: 'neutral' };

    const pending = preview.kinds.reduce((sum, x) => sum + x.new + x.updated, 0);

    return pending > 0 ? { label: `${pending.toLocaleString()} to download`, tone: 'amber' } : { label: 'up to date', tone: 'green' };
};

const environmentStatus = (x: HabboClientEnvironment): Status => {
    if (x.error)
        return { label: 'check failed', tone: 'red', title: x.error };

    if (!x.checkedAt)
        return { label: 'not checked', tone: 'neutral' };

    if (!x.liveVersion)
        return { label: 'no HTML client', tone: 'neutral', title: 'Its clienturls name no html-windows client.' };

    if (x.downloading)
        return { label: 'downloading', tone: 'accent' };

    if (x.downloadError)
        return { label: 'not downloaded', tone: 'red', title: x.downloadError };

    return x.version === x.liveVersion
        ? { label: 'downloaded', tone: 'green' }
        : { label: 'new release', tone: 'amber', title: 'It serves a release not downloaded yet: the next check downloads it.' };
};

/** The HTML client stands as the environment it is built from does; any check that failed says so first. */
const htmlClientStatus = (client: HabboClientStatus): Status => {
    const failed = client.environments.map(environmentStatus).find(x => x.tone === 'red');
    const followed = client.environments.find(x => x.environment === client.follow);

    if (failed)
        return failed;

    if (!followed)
        return { label: 'not downloaded', tone: 'neutral', title: 'No release is downloaded yet: the client libraries are not built from Habbo\'s client.' };

    const status = environmentStatus(followed);

    return status.tone === 'green' ? { label: 'up to date', tone: 'green' } : status;
};

const airClientStatus = (air: HabboAirClient | undefined): Status => {
    if (!air)
        return { label: 'unknown', tone: 'neutral', title: 'The server is older than the panel.' };

    if (!air.version)
        return { label: 'not named', tone: 'neutral', title: 'No environment named an AIR client when last checked.' };

    if (!air.kept)
        return { label: 'not downloaded', tone: 'neutral', title: 'It is downloaded when a build first needs it.' };

    return air.kept === air.version
        ? { label: 'up to date', tone: 'green' }
        : { label: 'new release', tone: 'amber', title: `Habbo serves ${air.version}: the next build downloads it.` };
};

/** A moment as how long ago it was, the date itself on hover. */
const When = ({ at, none = '-' }: { at: string | null | undefined; none?: string }) => (
    at ? <time dateTime={at} title={new Date(at).toLocaleString()}>{fromNow(at)}</time> : <span className="text-muted">{none}</span>
);

/** A badge with its reason on hover. */
const StatusBadge = ({ status }: { status: Status }) => <span title={status.title}><Badge tone={status.tone}>{status.label}</Badge></span>;

/** What Habbo has that the hotel doesn't, as nitro-studio counts it: new in green, changed in amber. */
const Changes = ({ added, changed }: { added: number; changed: number }) => (
    <span className="tabular-nums">
        {added > 0 && <span className="text-good">{`+${added.toLocaleString()} new`}</span>}
        {added > 0 && changed > 0 && ' '}
        {changed > 0 && <span className="text-warn">{`~${changed.toLocaleString()} changed`}</span>}
    </span>
);

/** How many of one kind of thing a source has, and what that means for the hotel. */
const Tile = ({ label, value, unit, detail, when }: { label: string; value: number | string | null; unit?: string; detail?: ReactNode; when?: ReactNode }) => (
    <div className="min-w-0 rounded-lg border border-line bg-surface px-3 py-2">
        <div className="truncate text-xs text-muted">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-base font-semibold tabular-nums">{value === null ? '–' : value.toLocaleString()}</span>
            {unit && value !== null && <span className="truncate text-[11px] text-muted">{unit}</span>}
        </div>
        {detail && <div className="truncate text-[11px]">{detail}</div>}
        {when && <div className="truncate text-[11px] text-muted">{when}</div>}
    </div>
);

/** A table inside a source's dropdown. */
const SubTable = ({ heads, children }: { heads: string[]; children: ReactNode }) => (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm [&_tbody_tr:last-child>td]:border-b-0">
            <thead>
                <tr>{heads.map(x => <Th key={x} className="px-3 whitespace-nowrap">{x}</Th>)}</tr>
            </thead>
            <tbody>{children}</tbody>
        </table>
    </div>
);

const Cell = ({ className, span, children }: { className?: string; span?: number; children?: ReactNode }) => (
    <td colSpan={span} className={cx('border-b border-line px-3 py-2 align-middle whitespace-nowrap', className)}>{children}</td>
);

/** A fact in a dropdown, for the columns a narrow screen hides. */
const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="min-w-0">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-0.5 truncate text-sm font-medium">{children}</div>
    </div>
);

/** The sources' columns, as a grid: the ones a narrower screen hides fold into each dropdown. */
const COLUMNS = 'grid grid-cols-[minmax(0,1fr)_9rem_2.75rem] md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,14rem)_2.75rem] lg:grid-cols-[minmax(0,1fr)_9rem_minmax(0,14rem)_8rem_12rem_11rem_2.75rem]';

const HEAD = 'px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase';

const CELL = 'min-w-0 px-4 py-2.5';

/** The sources' column heads. */
const SourceHeads = () => (
    <div className={cx(COLUMNS, 'border-b border-line')} role="row">
        <div className={HEAD} role="columnheader">Source</div>
        <div className={HEAD} role="columnheader">Status</div>
        <div className={cx(HEAD, 'hidden md:block')} role="columnheader">Habbo serves</div>
        <div className={cx(HEAD, 'hidden lg:block')} role="columnheader">Last checked</div>
        <div className={cx(HEAD, 'hidden lg:block')} role="columnheader">Last changed by Habbo</div>
        <div className={cx(HEAD, 'hidden lg:block')} role="columnheader">Last taken in</div>
        <div role="columnheader" />
    </div>
);

/**
 * A place updates come from, as a row: what it is and how it stands, what Habbo serves, and when it
 * was checked, changed and taken in; opened, what it has and what may be done with it.
 */
const SourceRow = ({ icon, name, host, status, serves, plain, checked, changed, taken, takenAs, about, open, onToggle, children, actions }: {
    icon: ReactNode;
    name: string;
    host?: string;
    status: Status;
    serves: string;
    /** Whether what it serves is words rather than a version. */
    plain?: boolean;
    checked: string | null | undefined;
    changed: string | null | undefined;
    taken: string | null | undefined;
    /** What taking in is, for this source: taken in, downloaded, built. */
    takenAs: string;
    about: string;
    open: boolean;
    onToggle: () => void;
    children?: ReactNode;
    actions?: ReactNode;
}) => (
    <div className="border-b border-line last:border-b-0" role="rowgroup">
        <button type="button" onClick={onToggle} aria-expanded={open} className={cx(COLUMNS, 'w-full items-center text-left text-sm hover:bg-subtle/60', open && 'bg-subtle/40')}>
            <span className={cx(CELL, 'flex items-center gap-3')}>
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent [&>svg]:size-4">{icon}</span>
                <span className="min-w-0">
                    <span className="block truncate font-medium">{name}</span>
                    {host && <span className="block truncate font-mono text-[11px] text-muted">{host}</span>}
                </span>
            </span>
            <span className={CELL}><StatusBadge status={status} /></span>
            <span className={cx(CELL, 'hidden truncate md:block', !plain && 'font-mono text-xs')}>{serves}</span>
            <span className={cx(CELL, 'hidden truncate lg:block')}><When at={checked} none="never" /></span>
            <span className={cx(CELL, 'hidden truncate lg:block')}><When at={changed} /></span>
            <span className={cx(CELL, 'hidden truncate lg:block')}>
                <When at={taken} none="never" />
                {taken && <span className="ml-1.5 text-xs text-muted">{takenAs}</span>}
            </span>
            <span className="grid place-items-center">
                <ChevronDown className={cx('size-4 text-muted transition-transform', open && 'rotate-180')} />
            </span>
        </button>
        {open && (
            <div className="flex min-w-0 flex-col gap-3 border-t border-line bg-canvas/50 px-4 py-4">
                <p className="text-xs text-muted">{about}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:hidden">
                    <Fact label="Habbo serves"><span className={cx(!plain && 'font-mono text-xs')}>{serves}</span></Fact>
                    <Fact label="Last checked"><When at={checked} none="never" /></Fact>
                    <Fact label="Last changed by Habbo"><When at={changed} /></Fact>
                    <Fact label={`Last ${takenAs}`}><When at={taken} none="never" /></Fact>
                </div>
                {children}
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </div>
        )}
    </div>
);

/** Habbo's gamedata, file by file as its /gamedata/hashes lists them: the hash now, and whether the hotel has taken it in. */
const GamedataFiles = ({ files, waiting }: { files: GamedataFile[]; waiting: (id: string) => number | null }) => (
    <SubTable heads={[ 'File', 'Habbo\'s hash', 'Has', 'Changed by Habbo', 'Taken in', 'To take in' ]}>
        {files.map((x) => {
            const count = waiting(x.id);
            const hash = x.version?.habboHash;

            return (
                <tr key={x.id}>
                    <Cell>
                        <div className="font-medium">{x.label}</div>
                        <div className="font-mono text-[11px] text-muted">{x.name}</div>
                    </Cell>
                    <Cell>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs" title={hash ?? undefined}>{hash ? `${hash.slice(0, 10)}…` : '-'}</span>
                            {x.version && (hashChanged(x)
                                ? <span title="Habbo lists this hash; the hotel hasn't taken it in."><Badge tone="amber">new hash</Badge></span>
                                : <span title="The hotel has taken in what Habbo lists under this hash."><Badge tone="green">taken in</Badge></span>)}
                        </div>
                    </Cell>
                    <Cell className="tabular-nums">{x.count ?? <span className="text-muted">not checked</span>}</Cell>
                    <Cell><When at={x.version?.foundAt} /></Cell>
                    <Cell><When at={x.version?.importedAt} none="not yet" /></Cell>
                    <Cell>
                        {count
                            ? <Link to={waitingLink(x.id)} className="font-medium text-warn hover:underline">{`${count.toLocaleString()} to take in`}</Link>
                            : <span className="text-muted">{count === 0 ? 'nothing' : '–'}</span>}
                    </Cell>
                </tr>
            );
        })}
    </SubTable>
);

/** Habbo's libraries, kind by kind: what Habbo has, what the hotel has of it, and what waits. */
const LibraryKinds = ({ preview, assets }: { preview: AssetSyncPreview; assets: AssetsStatus }) => (
    <SubTable heads={[ 'Kind', 'At Habbo', 'Up to date here', 'Your uploads', 'To download', 'Last downloaded' ]}>
        {LIBRARY_CATEGORIES.map((category) => {
            const kind = preview.kinds.find(x => x.kind === category.kind);
            const waiting = kind ? kind.new + kind.updated : 0;

            return (
                <tr key={category.id}>
                    <Cell className="font-medium">{category.label}</Cell>
                    {kind?.listed
                        ? (
                                <>
                                    <Cell className="tabular-nums">{kind.habboLibraries.toLocaleString()}</Cell>
                                    <Cell className="tabular-nums">{kind.upToDate.toLocaleString()}</Cell>
                                    <Cell className="text-muted tabular-nums">{kind.uploads > 0 ? kind.uploads.toLocaleString() : '–'}</Cell>
                                    <Cell>
                                        {waiting > 0
                                            ? <Link to={waitingLink(category.id)} className="hover:underline"><Changes added={kind.new} changed={kind.updated} /></Link>
                                            : <span className="text-good">all up to date</span>}
                                    </Cell>
                                </>
                            )
                        : <Cell className="text-bad" span={4}>Habbo's list couldn't be read</Cell>}
                    <Cell><When at={assets.kinds.find(x => x.kind === category.kind)?.updatedAt} none="none yet" /></Cell>
                </tr>
            );
        })}
    </SubTable>
);

/** Habbo's environments serving its HTML client: what each serves, and what the hotel downloaded. */
const Environments = ({ client }: { client: HabboClientStatus }) => (
    <SubTable heads={[ 'Environment', 'Status', 'Serves', 'Downloaded', 'Checked' ]}>
        {client.environments.map(x => (
            <tr key={x.environment}>
                <Cell>
                    <span className="font-medium capitalize">{x.environment}</span>
                    {x.environment === client.follow && <Badge tone="accent" className="ml-2">built from</Badge>}
                    <div className="font-mono text-[11px] text-muted">{x.host}</div>
                </Cell>
                <Cell><StatusBadge status={environmentStatus(x)} /></Cell>
                <Cell className="font-mono text-xs">{x.liveVersion ?? '-'}</Cell>
                <Cell className="font-mono text-xs">{x.version ?? '-'}</Cell>
                <Cell><When at={x.checkedAt} none="never" /></Cell>
            </tr>
        ))}
    </SubTable>
);

/** The HTML client's dropdown: its environments, how much is built from it, and the releases and bundles in full. */
const HtmlClientContent = ({ client, build, canManage }: { client: HabboClientStatus; build: HabboClientBuild | undefined; canManage: boolean }) => {
    const [ open, setOpen ] = useState(false);
    const followed = client.releases.find(x => x.version === client.followed);
    const templates = build?.libraries.filter(x => x.kind === 'template' || x.kind === 'window-manager') ?? [];
    const own = build?.libraries.filter(x => x.kind !== 'template' && x.kind !== 'window-manager') ?? [];
    const updated = (libraries: typeof own) => {
        const at = latest(libraries.map(x => x.updatedAt));

        return at ? `updated ${fromNow(at)}` : undefined;
    };

    return (
        <>
            <Environments client={client} />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <Tile label="Libraries in the release" value={followed ? followed.libraries.length : null} unit="libraries" detail={followed && <span className="text-muted">{`${followed.fileCount.toLocaleString()} files · ${megabytes(followed.size)}`}</span>} />
                <Tile label="Releases kept" value={client.releases.length} unit="releases" detail={<span className="text-muted">{megabytes(client.releases.reduce((sum, x) => sum + x.size, 0))}</span>} />
                <Tile label="Client bundles built" value={build ? own.length : null} unit="bundles" detail={<span className="text-muted">avatar, Variable FX, texts, chat</span>} when={updated(own)} />
                <Tile
                    label="Window templates built"
                    value={build ? templates.length : null}
                    unit="libraries"
                    detail={build && build.problems.length > 0
                        ? <span className="text-warn">{`${build.problems.length} ${build.problems.length === 1 ? 'problem' : 'problems'}`}</span>
                        : <span className="text-good">no problems</span>}
                    when={updated(templates)}
                />
            </div>
            {(client.releases.length > 0 || (build && build.libraries.length > 0)) && (
                <div className="rounded-lg border border-line bg-surface">
                    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex min-h-10 w-full items-center gap-1.5 px-4 py-2 text-left text-xs text-muted hover:text-ink">
                        <ChevronDown className={cx('size-3.5 shrink-0 transition-transform', open && 'rotate-180')} />
                        {open ? 'Hide the releases and bundles' : 'Show the releases kept, the bundles built and what the last build said'}
                    </button>
                    {open && <div className="border-t border-line"><HabboClientDetails client={client} build={build} canManage={canManage} /></div>}
                </div>
            )}
        </>
    );
};

const HtmlClientActions = ({ client }: { client: HabboClientStatus }) => {
    const check = useCheckHabboClient();
    const startBuild = useStartClientBuild();
    const { data: job } = useAssetJob();

    return (
        <>
            <Button variant="secondary" icon={<RefreshCw className={cx(check.isPending && 'animate-spin')} />} disabled={check.isPending} onClick={() => check.mutate(undefined, { onError: toastError })}>
                {check.isPending ? 'Asking' : 'Check the client'}
            </Button>
            <Button
                variant="secondary"
                icon={<Hammer />}
                disabled={startBuild.isPending || job?.status === 'running' || !client.followed}
                title="Builds every library from the release followed again, whether it changed or not"
                onClick={() => startBuild.mutate(undefined, { onError: toastError })}
            >
                Build now
            </Button>
        </>
    );
};

const LibraryActions = ({ pending, canManage }: { pending: number; canManage: boolean }) => {
    const relist = useRelist();

    return (
        <>
            <Button
                variant="secondary"
                icon={<RefreshCw className={cx(relist.isPending && 'animate-spin')} />}
                disabled={relist.isPending}
                onClick={() => relist.mutate(undefined, { onError: toastError })}
            >
                {relist.isPending ? 'Reading' : 'Read Habbo\'s lists again'}
            </Button>
            {canManage && <SyncButton pending={pending} variant="secondary" />}
        </>
    );
};

/**
 * Where updates come from - Habbo's gamedata, its libraries, and its HTML and AIR clients - as a
 * table: each with how it stands, what Habbo serves, and when it was checked, changed and taken in;
 * opened, what it has, kind by kind, as nitro-studio lays its sources out.
 */
export const SourcesTab = ({ status, assets, canManage, categories }: { status: GamedataStatus; assets: AssetsStatus; canManage: boolean; categories: Category[] }) => {
    const { data: client, error: clientError } = useHabboClient();
    const { data: build } = useHabboClientBuild();
    const { data: preview, error: previewError } = useSyncPreview();
    const [ open, setOpen ] = useState<string[]>([]);
    const files = gamedataFiles(status);
    const versions = files.map(x => x.version);
    const air = client?.air;
    const followed = client?.releases.find(x => x.version === client.followed);
    const pending = preview?.kinds.reduce((sum, x) => sum + x.new + x.updated, 0) ?? 0;
    const waiting = (id: string) => categories.find(x => x.id === id)?.count ?? null;
    const toggle = (id: string) => () => setOpen(was => (was.includes(id) ? was.filter(x => x !== id) : [ ...was, id ]));
    const loading: Status = { label: 'reading', tone: 'neutral' };
    const changedFiles = files.filter(hashChanged).length;
    const clientChecked = latest(client?.environments.map(x => x.checkedAt) ?? []);

    return (
        <Panel title="Sources" description="Where Habbo updates come from. Open one for what it has, kind by kind, and what can be done with it.">
            <div role="table" aria-label="Sources">
                <SourceHeads />

                <SourceRow
                    icon={<Database />}
                    name="Habbo's gamedata"
                    host={`www.habbo.${status.latestRelease?.domain ?? 'com'}/gamedata/hashes`}
                    status={gamedataStatus(files)}
                    serves={changedFiles > 0 ? `${files.length} files, ${changedFiles} with a new hash` : `${files.length} files`}
                    plain
                    checked={latest(versions.map(x => x?.checkedAt))}
                    changed={latest(versions.map(x => x?.foundAt))}
                    taken={latest(versions.map(x => x?.importedAt))}
                    takenAs="taken in"
                    about="What each piece of furniture, clothing and product is, and the texts and variables the client reads, file by file as Habbo's /gamedata/hashes lists them. A new hash is one the hotel hasn't taken in."
                    open={open.includes('gamedata')}
                    onToggle={toggle('gamedata')}
                >
                    <GamedataFiles files={files} waiting={waiting} />
                </SourceRow>
                <SourceRow
                    icon={<Library />}
                    name="Habbo's libraries"
                    host={preview ? `images.habbo.${preview.domain}` : undefined}
                    status={libraryStatus(preview, previewError)}
                    serves={preview ? revision(preview.revision) : '-'}
                    checked={preview?.listedAt}
                    changed={null}
                    taken={latest(assets.kinds.map(x => x.updatedAt))}
                    takenAs="downloaded"
                    about={`The furniture, clothing, effects, pets and other bundles Habbo serves; a sync downloads and converts the ones the hotel lacks or has older. The hotel has ${assets.kinds.reduce((sum, x) => sum + x.bundles, 0).toLocaleString()} bundles.`}
                    open={open.includes('libraries')}
                    onToggle={toggle('libraries')}
                    actions={<LibraryActions pending={pending} canManage={canManage} />}
                >
                    {preview && <LibraryKinds preview={preview} assets={assets} />}
                    {previewError && <ErrorNotice error={previewError} />}
                    {!preview && !previewError && <Loading />}
                </SourceRow>
                <SourceRow
                    icon={<MonitorDown />}
                    name="Habbo's HTML client"
                    host={client?.environments.find(x => x.environment === client.follow)?.host}
                    status={client ? htmlClientStatus(client) : loading}
                    serves={client?.followed ?? '-'}
                    checked={clientChecked}
                    changed={followed?.builtAt ?? followed?.downloadedAt}
                    taken={build?.builtAt}
                    takenAs="built"
                    about="The desktop client Habbo ships: the avatar data, Variable FX, texts, chat styles and window templates are built from its libraries."
                    open={open.includes('html')}
                    onToggle={toggle('html')}
                    actions={client && canManage && <HtmlClientActions client={client} />}
                >
                    {clientError && <ErrorNotice error={clientError} />}
                    {client && <HtmlClientContent client={client} build={build} canManage={canManage} />}
                    {!client && !clientError && <Loading />}
                </SourceRow>
                <SourceRow
                    icon={<Wind />}
                    name="Habbo's AIR client"
                    status={client ? airClientStatus(air) : loading}
                    serves={air?.version ?? '-'}
                    checked={clientChecked}
                    changed={air?.builtAt}
                    taken={air?.downloadedAt}
                    takenAs="downloaded"
                    about="The older Flash client. Some bitmaps and layouts only it has; the window templates take those from it, and it is downloaded when a build needs it."
                    open={open.includes('air')}
                    onToggle={toggle('air')}
                >
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                        <Tile label="Images taken" value={build?.airVersion ? build.airImages ?? 0 : null} unit="bitmaps" detail={<span className="text-muted">the HTML client lacks</span>} />
                        <Tile label="Layouts taken" value={build?.airVersion ? build.airLayouts ?? 0 : null} unit="layouts" detail={<span className="text-muted">in place of the HTML client's</span>} />
                        <Tile label="HabboAir.swf" value={air?.kept ? megabytes(air.size) : null} detail={<span className="text-muted">{air?.kept ? `release ${air.kept}` : 'none kept'}</span>} />
                    </div>
                    {!build?.airVersion && build?.builtAt && <p className="text-xs text-muted">The last build took nothing from it.</p>}
                </SourceRow>
            </div>
        </Panel>
    );
};
