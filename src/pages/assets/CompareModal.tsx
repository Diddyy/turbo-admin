import { useEffect, useState } from 'react';

import { type AssetComparison, type AssetTarget, type BundleKind, comparedImage, type CompareEntry, type CompareResult, type CompareTexts, type CompareWindow, type DiffChange, useTargetCompare } from '#/api/bundles';
import { Modal } from '#/components/Modal';
import { Badge, type BadgeTone, EmptyState, ErrorNotice, Loading } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';

import { formatBytes, formatTime } from './format';

const RESULTS: Record<CompareResult, { label: string; tone: BadgeTone }> = {
    changed: { label: 'changed', tone: 'amber' },
    'stamp-only': { label: 'stamp only', tone: 'green' },
    same: { label: 'same', tone: 'green' },
    'not-on-target': { label: 'not on target', tone: 'accent' },
    unreadable: { label: 'unreadable', tone: 'red' },
};

const SIGNS: Record<DiffChange, string> = { added: '+', removed: '-', changed: '~' };

const SIGN_COLOURS: Record<DiffChange, string> = { added: 'text-good', removed: 'text-bad', changed: 'text-warn' };

/** Images shown with their thumbnails at once; past this, a click shows them. */
const THUMBS_AT_ONCE = 24;

/** The kinds whose file is a `.nitro` bundle, an image in which is asked for by its name in it. */
const BUNDLE_KINDS = new Set<BundleKind>([ 'furniture', 'effect', 'pet', 'figure', 'template', 'room' ]);

const SOURCES = { habbo: 'from Habbo', upload: 'uploaded', built: 'built by the hotel' };

/** A window's id without its library (`habbo-catalog-com/catalog_xml` is `catalog_xml`). */
const shortId = (id: string) => id.slice(id.indexOf('/') + 1);

const Sign = ({ change }: { change: DiffChange }) => <span className={cx('w-3 shrink-0 text-center font-mono font-semibold', SIGN_COLOURS[change])}>{SIGNS[change]}</span>;

/** Names in a line, each signed: `+offer_source_1 -sort`. */
const Names = ({ label, added, removed, changed = [] }: { label: string; added: string[]; removed: string[]; changed?: string[] }) => added.length + removed.length + changed.length === 0
    ? null
    : (
            <p className="text-xs text-muted">
                {`${label}: `}
                {[ ...added.map(x => [ 'added', x ] as const), ...removed.map(x => [ 'removed', x ] as const), ...changed.map(x => [ 'changed', x ] as const) ].map(([ change, name ]) => (
                    <span key={`${change}${name}`} className={cx('mr-2 font-mono', SIGN_COLOURS[change])}>{`${SIGNS[change]}${name}`}</span>
                ))}
            </p>
        );

const Windows = ({ windows }: { windows: CompareWindow[] }) => (
    <section aria-label="Windows" className="flex flex-col gap-1">
        <h4 className="text-xs font-semibold">{`Windows (${windows.length})`}</h4>
        <ul className="flex flex-col gap-1.5">
            {windows.map(window => (
                <li key={window.id} className="flex gap-2 text-xs">
                    <Sign change={window.change} />
                    <div className="min-w-0 flex-1">
                        <span className="font-mono" title={window.id}>{shortId(window.id)}</span>
                        <Names label="elements" added={window.elementsAdded} removed={window.elementsRemoved} changed={window.elementsChanged} />
                        <Names label="text keys" added={window.textKeysAdded} removed={window.textKeysRemoved} />
                    </div>
                </li>
            ))}
        </ul>
    </section>
);

/** One language's difference, without its language: what languages with the same difference share. */
const textsKey = (texts: CompareTexts) => JSON.stringify([ texts.added, texts.removed, texts.changed, texts.edits ]);

const count = (n: number, what: string) => `${n.toLocaleString()} ${what}`;

/** Each language's texts, the languages that differ alike shown together (`en, de, fr: 11 removed`). */
const Texts = ({ texts }: { texts: CompareTexts[] }) => {
    const groups = new Map<string, { languages: string[]; texts: CompareTexts }>();

    for (const language of texts) {
        const key = textsKey(language);
        const group = groups.get(key);

        if (group)
            group.languages.push(language.language);
        else
            groups.set(key, { languages: [ language.language ], texts: language });
    }

    return (
        <section aria-label="Texts" className="flex flex-col gap-1">
            <h4 className="text-xs font-semibold">{`Texts (${texts.length} ${texts.length === 1 ? 'language' : 'languages'})`}</h4>
            {[ ...groups.values() ].map(({ languages, texts: group }) => (
                <details key={languages.join()} className="text-xs">
                    <summary className="cursor-pointer">
                        <span className="font-mono">{languages.join(', ')}</span>
                        {languages.length > 1 && <span className="text-muted">{` (${languages.length})`}</span>}
                        {': '}
                        {[ group.added && count(group.added, 'added'), group.removed && count(group.removed, 'removed'), group.changed && count(group.changed, 'changed') ].filter(Boolean).join(', ')}
                    </summary>
                    <ul className="mt-1 flex flex-col gap-0.5 pl-4">
                        {group.edits.map(edit => (
                            <li key={edit.key} className="flex gap-2">
                                <Sign change={edit.change} />
                                <span className="shrink-0 font-mono">{edit.key}</span>
                                <span className="min-w-0 truncate text-muted" title={`${edit.before ?? ''} -> ${edit.after ?? ''}`}>
                                    {edit.change === 'changed' ? `"${edit.before}" -> "${edit.after}"` : `"${edit.after ?? edit.before}"`}
                                </span>
                            </li>
                        ))}
                        {group.edits.length < group.added + group.removed + group.changed && (
                            <li className="text-muted">{`and ${(group.added + group.removed + group.changed - group.edits.length).toLocaleString()} more`}</li>
                        )}
                    </ul>
                </details>
            ))}
        </section>
    );
};

const isImage = (name: string) => /\.(png|gif)$/i.test(name);

/** An image as one side holds it, fetched with the session (an `<img>` alone can't send it). */
const Thumb = ({ targetId, item, entry, side, label }: { targetId: number; item: AssetComparison; entry: CompareEntry; side: 'target' | 'hotel'; label: string }) => {
    const [ url, setUrl ] = useState<string | null>(null);
    const bundle = BUNDLE_KINDS.has(item.kind);

    useEffect(() => {
        let made: string | null = null;
        let live = true;

        comparedImage(targetId, item.path, bundle ? entry.name : null, side).then((blob) => {
            made = URL.createObjectURL(blob);

            if (live)
                setUrl(made);
        }).catch(() => setUrl(null));

        return () => {
            live = false;

            if (made) URL.revokeObjectURL(made);
        };
    }, [ targetId, item.path, entry.name, side, bundle ]);

    return (
        <figure className="flex flex-col items-center gap-0.5">
            <div className="grid size-16 place-items-center rounded-md border border-line bg-[repeating-conic-gradient(var(--color-subtle)_0_25%,transparent_0_50%)] bg-[length:12px_12px]">
                {url && <img src={url} alt={`${entry.name} (${label})`} className="max-h-full max-w-full [image-rendering:pixelated]" />}
            </div>
            <figcaption className="text-[10px] text-muted">{label}</figcaption>
        </figure>
    );
};

const sizeOf = (bytes: number | null, width: number | null, height: number | null) => bytes === null
    ? '-'
    : `${width !== null && height !== null ? `${width}x${height}, ` : ''}${formatBytes(bytes)}`;

const Entries = ({ targetId, item }: { targetId: number; item: AssetComparison }) => {
    const images = item.entries.filter(x => isImage(x.name)).length;
    const [ thumbs, setThumbs ] = useState(images <= THUMBS_AT_ONCE);

    return (
        <section aria-label="Files" className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold">{`Files (${item.entriesChanged.toLocaleString()})`}</h4>
                {!thumbs && <button type="button" className="text-xs text-accent hover:underline" onClick={() => setThumbs(true)}>{`Show the ${images} images`}</button>}
            </div>
            <ul className="flex flex-col gap-1.5">
                {item.entries.map(entry => (
                    <li key={entry.name} className="flex items-center gap-2 text-xs">
                        <Sign change={entry.change} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate font-mono" title={entry.name}>{entry.name}</p>
                            <p className="text-muted">{`${sizeOf(entry.bytesBefore, entry.widthBefore, entry.heightBefore)} -> ${sizeOf(entry.bytesAfter, entry.widthAfter, entry.heightAfter)}`}</p>
                        </div>
                        {thumbs && isImage(entry.name) && (
                            <div className="flex shrink-0 gap-2">
                                {entry.change !== 'added' && <Thumb targetId={targetId} item={item} entry={entry} side="target" label="target" />}
                                {entry.change !== 'removed' && <Thumb targetId={targetId} item={item} entry={entry} side="hotel" label="hotel" />}
                            </div>
                        )}
                    </li>
                ))}
                {item.entries.length < item.entriesChanged && <li className="text-xs text-muted">{`and ${(item.entriesChanged - item.entries.length).toLocaleString()} more`}</li>}
            </ul>
        </section>
    );
};

/** Where the hotel's copy came from and when it changed, and the build stamp of each copy. */
const Provenance = ({ item }: { item: AssetComparison }) => (
    <p className="text-xs text-muted">
        {item.source ? `Hotel's copy ${SOURCES[item.source]}` : 'Hotel\'s copy'}
        {item.updatedAt && <span title={formatTime(item.updatedAt)}>{`, changed ${fromNow(item.updatedAt)}`}</span>}
        {(item.stampBefore || item.stampAfter) && (
            <>
                {', build '}
                <span className="font-mono">{item.stampBefore ?? '-'}</span>
                {' -> '}
                <span className="font-mono">{item.stampAfter ?? '-'}</span>
            </>
        )}
        {item.targetSize !== null && `. Target's copy ${formatBytes(item.targetSize)}, hotel's ${formatBytes(item.size)}`}
        {item.targetSize !== null && !item.targetAsRecorded && <span className="text-warn"> (not the copy recorded as sent: it changed on the target)</span>}
    </p>
);

const Comparison = ({ targetId, item }: { targetId: number; item: AssetComparison }) => (
    <li aria-label={item.path} className="flex flex-col gap-2 px-5 py-3">
        <div className="flex items-center gap-2">
            <Badge tone={RESULTS[item.result].tone}>{RESULTS[item.result].label}</Badge>
            <span className="min-w-0 flex-1 truncate font-mono text-sm" title={item.path}>{item.path}</span>
        </div>
        <Provenance item={item} />
        {item.result === 'stamp-only' && <p className="text-xs">Only the build stamp differs: sending it changes nothing for players.</p>}
        {item.result === 'same' && <p className="text-xs">They hold the same: sending it changes nothing for players.</p>}
        {item.result === 'not-on-target' && <p className="text-xs">The target holds no copy of it: a publish sends it again.</p>}
        {item.problem && <p className="text-xs text-bad">{item.problem}</p>}
        {item.windows.length > 0 && <Windows windows={item.windows} />}
        {item.texts.length > 0 && <Texts texts={item.texts} />}
        {item.entries.length > 0 && <Entries targetId={targetId} item={item} />}
    </li>
);

/** What a "compare all" found, in a line: `20 changed files: 17 stamp only, 3 changed`. */
const summary = (items: AssetComparison[], total: number) => {
    const counts = new Map<CompareResult, number>();

    for (const item of items)
        counts.set(item.result, (counts.get(item.result) ?? 0) + 1);

    const parts = [ ...counts ].map(([ result, n ]) => `${n.toLocaleString()} ${RESULTS[result].label}`).join(', ');

    return `${total.toLocaleString()} changed ${total === 1 ? 'file' : 'files'}${items.length < total ? ` (the ${items.length} largest compared)` : ''}: ${parts}`;
};

/**
 * What changed in a file a target holds an older copy of (`path`), or in every changed file
 * (`path` empty): the target's copy, read through the target, against the hotel's. Files that differ
 * only in the build stamp are listed together after the real changes.
 */
export const CompareModal = ({ target, path, onClose }: { target: AssetTarget; path: string | null; onClose: () => void }) => {
    const { data, error } = useTargetCompare(path === null ? null : target.id, path ?? '');
    const real = data?.items.filter(x => x.result !== 'stamp-only' && x.result !== 'same') ?? [];
    const quiet = data?.items.filter(x => x.result === 'stamp-only' || x.result === 'same') ?? [];

    return (
        <Modal open={path !== null} onClose={onClose} title={`${target.name}: ${path ? `compare ${path.split('/').pop()}` : 'compare all changed'}`} className="sm:h-fit! sm:max-w-3xl">
            {error && <div className="p-5"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {data && data.items.length === 0 && <EmptyState>Nothing is pending as changed.</EmptyState>}
            {data && data.items.length > 0 && (
                <>
                    {!path && <p className="border-b border-line px-5 py-2 text-xs text-muted">{summary(data.items, data.total)}</p>}
                    <ul aria-label={`${target.name}: compared`} className="divide-y divide-line">
                        {real.map(item => <Comparison key={item.path} targetId={target.id} item={item} />)}
                        {path && quiet.map(item => <Comparison key={item.path} targetId={target.id} item={item} />)}
                        {!path && quiet.length > 0 && (
                            <li aria-label="No change for players" className="flex flex-col gap-1 px-5 py-3">
                                <h4 className="text-xs font-semibold">{`No change for players (${quiet.length})`}</h4>
                                <ul className="flex flex-col gap-0.5">
                                    {quiet.map(item => (
                                        <li key={item.path} className="flex items-center gap-2 text-xs">
                                            <Badge tone="green">{RESULTS[item.result].label}</Badge>
                                            <span className="min-w-0 flex-1 truncate font-mono" title={item.path}>{item.path}</span>
                                            {item.stampBefore && item.stampAfter && <span className="shrink-0 font-mono text-muted">{`${item.stampBefore} -> ${item.stampAfter}`}</span>}
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        )}
                    </ul>
                </>
            )}
        </Modal>
    );
};
