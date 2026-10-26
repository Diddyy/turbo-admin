import { useQuery } from '@tanstack/react-query';
import { Check, ImageOff, Search, Upload } from 'lucide-react';
import { type DragEvent, type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

import {
    type FieldShape,
    type ImageAccept,
    mediaFilePath,
    type MediaImage,
    shapeParam,
    uploadTargetsOf,
    useMediaImage,
    useMediaSearch,
    useUploadForField,
    valueKeyOf,
    valueOf,
} from '#/api/media';
import { cx } from '#/lib/cx';
import { apiImageQuery } from '#/preview/images';

import { Modal } from './Modal';
import { toast, toastError } from './toast';
import { Badge, Button, Chip, Input, Select, TextLink } from './ui';

/** How many images a page of the grid has. */
const PAGE = 60;

/** How many recent picks are kept for each kind of field. */
const RECENT = 12;

const RECENT_KEY = 'turbo-admin-media-recent';

const SHAPE_LABELS: Record<FieldShape, string> = {
    catalogPicture: 'a catalog picture',
    catalogIcon: 'a catalog icon',
    clientImage: 'a client image',
    relative: 'a path in the image library',
    libraryUrl: 'an image library address',
    plugin: 'an image of the theme\'s',
    badge: 'a badge',
    url: 'an address',
};

/** An image's folder: its path without its name. */
const folderOf = (image: MediaImage) => (image.path.includes('/') ? image.path.slice(0, image.path.lastIndexOf('/')) : '');

const recentOf = (area: string): MediaImage[] => {
    try {
        return (JSON.parse(localStorage.getItem(RECENT_KEY) ?? '{}') as Record<string, MediaImage[]>)[area] ?? [];
    } catch {
        return [];
    }
};

const remember = (area: string, item: MediaImage) => {
    try {
        const all = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '{}') as Record<string, MediaImage[]>;
        all[area] = [ { ...item, usedOn: null }, ...(all[area] ?? []).filter(x => x.id !== item.id) ].slice(0, RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(all));
    } catch {
        // A browser that keeps nothing just has no recent picks.
    }
};

/** An image's thumbnail: from the admin API with the session's token, or straight from its host. */
export const MediaThumb = ({ url, className, large }: { url: string | null; className?: string; large?: boolean }) => {
    const fromApi = url?.startsWith('/') ? url : null;
    const picture = useQuery(apiImageQuery(fromApi));
    const [ failed, setFailed ] = useState<string | null>(null);
    const src = fromApi ? picture.data?.src : url;
    const broken = (fromApi && picture.isError) || (!!url && failed === url);

    return (
        <span className={cx('grid shrink-0 place-items-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--color-subtle)_0_25%,transparent_0_50%)] bg-[length:12px_12px]', className)}>
            {src && !broken
                ? <img src={src} alt="" loading="lazy" onError={() => setFailed(url)} className={cx('max-h-full max-w-full object-contain [image-rendering:pixelated]', large && 'min-h-8 min-w-8')} />
                : (broken || !url) && <ImageOff className="size-4 text-muted" aria-label={url ? 'The picture could not be loaded' : 'No picture'} />}
        </span>
    );
};

const sizeOf = (item: MediaImage) => [
    item.width && item.height ? `${item.width}×${item.height}` : null,
    item.bytes < 1024 ? `${item.bytes} B` : `${(item.bytes / 1024).toFixed(1)} KB`,
].filter(Boolean).join(' · ');

/** The image picked in the grid, large, with what it is, where it is used and the value it writes. */
const Detail = ({ item, accept, onUse }: { item: MediaImage; accept: ImageAccept; onUse: (item: MediaImage) => void }) => {
    const full = useMediaImage(item.id).data ?? item;
    const value = valueOf(full, accept);

    return (
        <div className="flex flex-col gap-3" data-testid="media-detail">
            <MediaThumb url={mediaFilePath(full)} large className="h-40 w-full border border-line" />
            <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-mono text-[13px] font-medium" title={full.name}>{full.name}</span>
                <span className="truncate text-xs text-muted" title={folderOf(full)}>{folderOf(full)}</span>
                <span className="flex flex-wrap gap-1">
                    <Badge>{full.source}{full.sourceDetail ? `: ${full.sourceDetail}` : ''}</Badge>
                    <Badge>{full.kind}</Badge>
                    {sizeOf(full) && <Badge>{sizeOf(full)}</Badge>}
                </span>
            </div>
            <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted">Writes</span>
                {value
                    ? <span className="font-mono break-all" data-testid="media-detail-value">{value}</span>
                    : <span className="text-warn">This field takes {accept.shapes.map(x => SHAPE_LABELS[x]).join(' or ')}, which this picture has no name as.</span>}
            </div>
            <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted">{full.usedCount === 0 ? 'Used nowhere yet' : `Used ${full.usedCount === 1 ? 'once' : `${full.usedCount} times`}`}</span>
                {full.usedOn?.slice(0, 8).map(use => (
                    <span key={`${use.area}:${use.id}:${use.field}`} className="truncate" title={use.field}>
                        {use.link ? <TextLink to={use.link}>{use.title}</TextLink> : use.title}
                    </span>
                ))}
            </div>
            <Button icon={<Check />} disabled={!value} onClick={() => onUse(full)}>Use this</Button>
        </div>
    );
};

type Tab = 'all' | 'used' | 'recent';

interface PickerProps {
    accept: ImageAccept;
    value: string;
    onPick: (value: string) => void;
    onClose: () => void;
    /** A field that may show none: the words of the choice that clears it. */
    none?: string;
}

/** What the picker holds while it is open: drawn only then, so each opening starts over. */
const PickerBody = ({ accept, value, onPick, onClose, none }: PickerProps) => {
    const area = accept.usedIn ?? accept.shapes.join(',');
    const [ tab, setTab ] = useState<Tab>('all');
    const [ text, setText ] = useState('');
    const [ kinds, setKinds ] = useState<string[]>(accept.kinds ?? []);
    const [ source, setSource ] = useState('');
    const [ page, setPage ] = useState(1);
    // The one picked stays picked when the grid changes under it as a search answers; none picked is the first.
    const [ picked, setPicked ] = useState<MediaImage | null>(null);
    const [ uploaded, setUploaded ] = useState<MediaImage[]>([]);
    const [ typed, setTyped ] = useState('');
    const [ dropping, setDropping ] = useState(false);
    const [ targetKey, setTargetKey ] = useState('');
    const grid = useRef<HTMLUListElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const gridId = useId();
    const keys = useMemo(() => [ ...new Set(accept.shapes.map(valueKeyOf)) ], [ accept.shapes ]);
    const words = text.trim();
    const shownTab: Tab = words ? 'all' : tab;

    const search = useMediaSearch({
        // A theme's own images are found under its plugin's key too.
        q: [ words, keys.length === 1 && keys[0] === 'plugin' ? accept.plugin : '' ].filter(Boolean).join(' '),
        kind: (shownTab === 'all' ? kinds : accept.kinds ?? []).join(','),
        source: shownTab === 'all' ? source : '',
        shape: keys.map(shapeParam).join(','),
        used: shownTab === 'used' ? 'used' : 'all',
        sort: shownTab === 'used' ? 'used' : words ? 'name' : 'modified',
        desc: !words,
        page: page - 1,
        size: PAGE,
    }, shownTab !== 'recent');
    const facets = useMemo(() => ({
        kinds: Object.entries(search.data?.facets.kinds ?? {}).map(([ key, count ]) => ({ key, count })),
        sources: Object.entries(search.data?.facets.sources ?? {}).map(([ key, count ]) => ({ key, count })),
    }), [ search.data ]);
    const targets = search.data?.canManage === false ? [] : uploadTargetsOf(accept);
    const upload = useUploadForField();
    const target = targets.find(x => x.key === targetKey) ?? targets[0];

    const items = useMemo(() => {
        const listed = shownTab === 'recent' ? recentOf(area) : search.data?.items ?? [];

        return [ ...uploaded, ...listed.filter(x => !uploaded.some(y => y.id === x.id)) ].filter(x => valueOf(x, accept) !== null);
    }, [ shownTab, area, search.data, uploaded, accept ]);
    const total = shownTab === 'recent' ? items.length : search.data?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / PAGE));
    const at = picked ? items.findIndex(x => x.id === picked.id) : 0;
    const current = picked ?? items[0];

    // The one picked in the grid stays in sight as the arrows move it.
    useEffect(() => {
        grid.current?.querySelector<HTMLElement>(`[data-index="${at}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [ at ]);

    const choose = (item: MediaImage | undefined) => {
        const picked = item && valueOf(item, accept);

        if (!item || !picked)
            return;

        remember(area, item);
        onPick(picked);
        onClose();
    };

    const take = (files: File[]) => {
        if (!files.length || !target)
            return;

        upload.mutate({ files, target }, {
            onSuccess: (result) => {
                for (const refused of result.refused)
                    toastError(new Error(`${refused.file}: ${refused.why}`));

                if (result.items.length) {
                    toast(result.items.length === 1 ? `Uploaded ${result.items[0]!.name}.` : `Uploaded ${result.items.length} pictures.`);
                    setUploaded(result.items);
                    setText('');
                    setTab('all');
                    setPicked(result.items[0]!);
                }
            },
            onError: toastError,
        });
    };

    /** How many tiles a row of the grid has, for the arrows up and down. */
    const columns = () => {
        const tiles = [ ...(grid.current?.children ?? []) ] as HTMLElement[];
        const top = tiles[0]?.offsetTop;

        return Math.max(1, tiles.filter(x => x.offsetTop === top).length);
    };

    const move = (event: KeyboardEvent, inSearch: boolean) => {
        const step = event.key === 'ArrowRight' && !inSearch
            ? 1
            : event.key === 'ArrowLeft' && !inSearch
                ? -1
                : event.key === 'ArrowDown'
                    ? columns()
                    : event.key === 'ArrowUp' ? -columns() : 0;

        if (step !== 0) {
            event.preventDefault();
            // Past either end of the grid it stays where it is.
            const next = items[Math.max(0, at) + step];

            if (next) setPicked(next);
        } else if (event.key === 'Enter') {
            // Never the page's form: the picker is drawn inside the editor that opened it.
            event.preventDefault();
            choose(current);
        }
    };

    const drop = (event: DragEvent) => {
        event.preventDefault();
        setDropping(false);
        take([ ...event.dataTransfer.files ].filter(x => x.type.startsWith('image/')));
    };

    const tabs: { key: Tab; label: string }[] = [
        { key: 'all', label: 'All' },
        { key: 'used', label: 'In use' },
        { key: 'recent', label: 'Recent' },
    ];

    return (
        <div
            data-testid="image-picker"
            className={cx('relative flex flex-col gap-3 p-4', dropping && 'ring-2 ring-accent ring-inset')}
            onDragOver={(event) => {
                if (target && event.dataTransfer.types.includes('Files')) {
                    event.preventDefault();
                    setDropping(true);
                }
            }}
            onDragLeave={event => !event.currentTarget.contains(event.relatedTarget as Node) && setDropping(false)}
            onDrop={drop}
        >
            <div className="flex flex-wrap items-center gap-2">
                <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-canvas px-2.5 focus-within:border-accent">
                    <Search className="size-4 shrink-0 text-muted" aria-hidden />
                    <input
                        autoFocus
                        aria-label="Find a picture"
                        role="combobox"
                        aria-expanded
                        aria-controls={gridId}
                        aria-activedescendant={current ? `${gridId}-${at}` : undefined}
                        value={text}
                        onChange={(event) => {
                            setText(event.target.value);
                            setPage(1);
                            setPicked(null);
                        }}
                        onKeyDown={event => move(event, true)}
                        placeholder="Find by name, folder or tag"
                        spellCheck={false}
                        className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
                    />
                </label>
                {shownTab === 'all' && facets.sources.length > 1 && (
                    <Select
                        aria-label="Source"
                        value={source}
                        onChange={(event) => {
                            setSource(event.target.value);
                            setPage(1);
                            setPicked(null);
                        }}
                    >
                        <option value="">Every source</option>
                        {facets.sources.map(x => <option key={x.key} value={x.key}>{`${x.key} (${x.count.toLocaleString()})`}</option>)}
                    </Select>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Pictures to show">
                {tabs.map(x => (
                    <Chip
                        key={x.key}
                        role="tab"
                        aria-selected={shownTab === x.key}
                        active={shownTab === x.key}
                        onClick={() => {
                            setTab(x.key);
                            setText('');
                            setPage(1);
                            setPicked(null);
                        }}
                    >
                        {x.label}
                    </Chip>
                ))}
                {shownTab === 'all' && facets.kinds.map(x => (
                    <Chip
                        key={x.key}
                        active={kinds.includes(x.key)}
                        onClick={() => {
                            setKinds(now => (now.includes(x.key) ? now.filter(y => y !== x.key) : [ ...now, x.key ]));
                            setPage(1);
                            setPicked(null);
                        }}
                    >
                        {x.key}
                        <span className="font-mono text-[10px] opacity-70">{x.count.toLocaleString()}</span>
                    </Chip>
                ))}
            </div>
            {accept.hint && <p className="text-xs text-muted">{accept.hint}</p>}
            <div className="grid gap-4 sm:grid-cols-[1fr_16rem]">
                <div className="flex min-w-0 flex-col gap-2">
                    {search.error && shownTab !== 'recent' && <p className="text-sm text-bad">The pictures couldn&apos;t be listed: {(search.error as Error).message}</p>}
                    <ul
                        ref={grid}
                        id={gridId}
                        role="listbox"
                        aria-label="Pictures"
                        tabIndex={0}
                        onKeyDown={event => move(event, false)}
                        className="grid max-h-[55dvh] grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] content-start gap-1.5 overflow-y-auto rounded-lg p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                        {items.map((item, index) => (
                            <li
                                key={item.id}
                                id={`${gridId}-${index}`}
                                data-index={index}
                                data-testid="media-tile"
                                role="option"
                                aria-selected={index === at}
                                title={`${folderOf(item) ? `${folderOf(item)}/` : ''}${item.name}`}
                                onClick={() => setPicked(item)}
                                onDoubleClick={() => choose(item)}
                                className={cx(
                                    'flex min-w-0 cursor-pointer flex-col items-center gap-1 rounded-lg border p-1.5',
                                    index === at ? 'border-accent bg-accent-soft' : valueOf(item, accept) === value.trim() ? 'border-accent/50' : 'border-line hover:border-muted/60',
                                )}
                            >
                                <MediaThumb url={mediaFilePath(item)} className="h-16 w-full" />
                                <span className="w-full truncate text-center font-mono text-[10.5px] text-muted">{item.name}</span>
                            </li>
                        ))}
                    </ul>
                    {items.length === 0 && (
                        <p className="py-6 text-center text-sm text-muted">
                            {shownTab === 'recent'
                                ? 'Nothing picked here yet.'
                                : search.isLoading
                                    ? 'Loading the pictures…'
                                    : shownTab === 'used'
                                        ? 'No picture like this is shown anywhere yet: look under All.'
                                        : 'No picture by that name.'}
                        </p>
                    )}
                    {shownTab !== 'recent' && pages > 1 && (
                        <div className="flex items-center justify-between gap-2 text-xs text-muted">
                            <span>{`${total.toLocaleString()} pictures, page ${page} of ${pages}`}</span>
                            <span className="flex gap-1">
                                <Button
                                    variant="ghost"
                                    disabled={page <= 1}
                                    onClick={() => {
                                        setPage(page - 1);
                                        setPicked(null);
                                    }}
                                >
                                    Back
                                </Button>
                                <Button
                                    variant="ghost"
                                    disabled={page >= pages}
                                    onClick={() => {
                                        setPage(page + 1);
                                        setPicked(null);
                                    }}
                                >
                                    More
                                </Button>
                            </span>
                        </div>
                    )}
                </div>
                <aside className="flex min-w-0 flex-col gap-3 sm:border-l sm:border-line sm:pl-4">
                    {current ? <Detail item={current} accept={accept} onUse={choose} /> : <p className="text-sm text-muted">Pick a picture to see it here.</p>}
                </aside>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                {target && (
                    <>
                        <Button variant="secondary" icon={<Upload />} disabled={upload.isPending} onClick={() => fileInput.current?.click()}>
                            {upload.isPending ? 'Uploading…' : 'Upload'}
                        </Button>
                        {targets.length > 1
                            ? (
                                    <Select aria-label="Upload into" value={target.key} onChange={event => setTargetKey(event.target.value)}>
                                        {targets.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
                                    </Select>
                                )
                            : <span className="text-xs text-muted">{`into ${target.label}`}</span>}
                        <span className="text-xs text-muted">or drop pictures here.</span>
                        <input
                            ref={fileInput}
                            type="file"
                            multiple
                            accept="image/png,image/gif,image/jpeg,image/webp"
                            aria-label="Upload pictures"
                            className="sr-only"
                            onChange={(event) => {
                                take([ ...(event.target.files ?? []) ]);
                                event.target.value = '';
                            }}
                        />
                    </>
                )}
                {none && (
                    <Button
                        variant="ghost"
                        onClick={() => {
                            onPick('');
                            onClose();
                        }}
                    >
                        {none}
                    </Button>
                )}
                <span className="ml-auto flex min-w-0 items-center gap-2">
                    <Input
                        aria-label="Or paste an address or name"
                        value={typed}
                        onChange={event => setTyped(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();

                                if (typed.trim()) {
                                    onPick(typed.trim());
                                    onClose();
                                }
                            }
                        }}
                        placeholder="Or paste an address or name"
                        spellCheck={false}
                        className="w-64 font-mono text-xs"
                    />
                    <Button
                        variant="ghost"
                        disabled={!typed.trim()}
                        onClick={() => {
                            onPick(typed.trim());
                            onClose();
                        }}
                    >
                        Use
                    </Button>
                </span>
            </div>
        </div>
    );
};

/**
 * The one image picker: every image the hotel can show, from the media library, found by words,
 * kind and source, drawn as a grid with the one picked shown large beside it and "Use this"; with
 * those already in use and the field's recent picks a tab away, files dropped onto it uploaded where the field
 * can name them, and an address or name to paste when the library has none. Arrows move through
 * the grid, Enter uses the one picked, Escape closes. It writes the value as the field stores it.
 */
export const ImagePicker = ({ open, title, ...picker }: PickerProps & { open: boolean; title?: string }) => (
    <Modal title={title ?? 'Pick a picture'} open={open} onClose={picker.onClose} className="sm:max-w-5xl">
        <PickerBody {...picker} />
    </Modal>
);
