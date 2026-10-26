import { useQuery } from '@tanstack/react-query';
import { Copy, ImageOff, LayoutGrid, List, Pencil, Trash2, Upload } from 'lucide-react';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { ApiError } from '#/api/client';
import { CATALOG_PICTURE, mediaFilePath, type MediaImage, type MediaQuery, type MediaUse, useDeleteMedia, useEditMedia, useMediaImage, useMediaSearch, useUploadMedia } from '#/api/media';
import { ask } from '#/components/confirm';
import { Pagination } from '#/components/Pagination';
import { SearchInput } from '#/components/SearchInput';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, Chip, EmptyState, ErrorNotice, IconButton, Input, Kv, Labeled, Loading, PageBody, PageHeader, Panel, Segmented, Select } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useDebounced } from '#/lib/debounce';
import { CHECKS } from '#/pages/catalog/CatalogImageThumb';
import { apiImageQuery } from '#/preview/images';

const PAGE_SIZE = 60;

const KIND_LABELS: Record<string, string> = {
    promo: 'Promo',
    reception: 'Hotel view',
    quest: 'Quest',
    'catalogue-picture': 'Catalog picture',
    'catalogue-icon': 'Catalog icon',
    badge: 'Badge',
    'furni-icon': 'Furniture icon',
    'client-image': 'Client image',
    theme: 'Theme',
    other: 'Other',
};

const SOURCE_LABELS: Record<string, string> = {
    library: 'Image library',
    assets: 'Asset folder',
    client: 'Client',
    plugin: 'Plugin',
    upload: 'Uploaded',
    habbo: 'From Habbo',
};

/** What each value a field can store is called, in the order the detail lists them. */
const VALUE_LABELS: [ keyof MediaImage['values'], string ][] = [
    [ 'relative', 'Path under the image library' ],
    [ 'catalogPicture', 'Catalog picture name' ],
    [ 'catalogIcon', 'Catalog icon number' ],
    [ 'clientImage', 'Client image name' ],
    [ 'badge', 'Badge code' ],
    [ 'plugin', 'Path in the plugin' ],
    [ 'url', 'Address' ],
];

const ACCEPT = 'image/png,image/gif,image/jpeg,image/webp,.png,.gif,.jpg,.jpeg,.webp';

const sizeOf = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`);

const copy = (text: string) => void navigator.clipboard.writeText(text).then(() => toast(`Copied ${text}`));

/** An image as this server has it, on checks, fitted into its box. */
const MediaThumb = ({ image, className }: { image: MediaImage; className?: string }) => {
    const picture = useQuery(apiImageQuery(mediaFilePath(image)));

    return (
        <span className={cx('grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line', CHECKS, className)}>
            {picture.data
                ? <img src={picture.data.src} alt="" className="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
                : picture.isError && <ImageOff className="size-4 text-muted" aria-label="Can't be drawn" />}
        </span>
    );
};

const UsedOnList = ({ uses }: { uses: MediaUse[] }) => (
    <ul className="flex flex-col gap-1" data-testid="media-used-on">
        {uses.map(use => (
            <li key={`${use.area}:${use.id}:${use.field}`} className="flex flex-wrap items-baseline gap-2 text-sm">
                <Badge>{use.area}</Badge>
                <Link to={use.link} className="text-accent hover:underline">{use.title}</Link>
                <span className="text-xs text-muted">{use.field}</span>
            </li>
        ))}
    </ul>
);

/** One image: big, every value a field stores for it, where it is shown, and (for staff who may) its tags, name and deletion. */
const Detail = ({ id, canManage, onGone }: { id: string; canManage: boolean; onGone: () => void }) => {
    const { data: image, error } = useMediaImage(id);
    const edit = useEditMedia();
    const del = useDeleteMedia();
    const [ tags, setTags ] = useState<string | null>(null);
    const [ name, setName ] = useState<string | null>(null);
    const [ inUse, setInUse ] = useState<MediaUse[] | null>(null);

    if (error) return <ErrorNotice error={error} />;
    if (!image) return <Loading />;

    const renamable = canManage && image.id.startsWith('library:');
    const deletable = canManage && !image.id.startsWith('client:') && !image.id.startsWith('plugin:');

    const remove = () => ask({
        title: `Delete ${image.path}?`,
        body: 'Its file goes from this server. Published copies stay until the assets are published again.',
        confirm: 'Delete',
        danger: true,
    }, () => del.mutate(image.id, {
        onSuccess: () => {
            toast(`Deleted ${image.path}.`);
            onGone();
        },
        onError: (failure) => {
            const uses = failure instanceof ApiError ? (failure.body?.usedOn as MediaUse[] | undefined) : undefined;

            if (uses) setInUse(uses);
            toastError(failure);
        },
    }));

    return (
        <div className="flex flex-col gap-4 p-4" data-testid="media-detail">
            <MediaThumb image={image} className="h-64 w-full" />
            <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-sm break-all">{image.path}</code>
                <Badge>{KIND_LABELS[image.kind] ?? image.kind}</Badge>
                <Badge tone="neutral">{SOURCE_LABELS[image.source] ?? image.source}{image.sourceDetail ? ` ${image.sourceDetail}` : ''}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <Kv label="Size">{image.width && image.height ? `${image.width} x ${image.height}` : 'unknown'}</Kv>
                <Kv label="File">{sizeOf(image.bytes)}</Kv>
                <Kv label="Changed">{image.modifiedUtc ? new Date(image.modifiedUtc).toLocaleString() : 'unknown'}</Kv>
            </div>
            <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">What a field stores</h3>
                {VALUE_LABELS.filter(([ key ]) => image.values[key] !== null && image.values[key] !== '').map(([ key, label ]) => (
                    <div key={key} className="flex items-center gap-2 text-sm">
                        <span className="w-44 shrink-0 text-muted">{label}</span>
                        <code className="min-w-0 flex-1 truncate font-mono text-xs" data-testid={`media-value-${key}`}>{String(image.values[key])}</code>
                        <IconButton small label={`Copy the ${label.toLowerCase()}`} icon={<Copy />} onClick={() => copy(String(image.values[key]))} />
                    </div>
                ))}
            </div>
            <div className="flex flex-col gap-1">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Shown on</h3>
                {(image.usedOn ?? []).length === 0 ? <span className="text-sm text-muted">Nothing shows it.</span> : <UsedOnList uses={image.usedOn!} />}
            </div>
            {canManage && (
                <form
                    className="flex items-end gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();
                        edit.mutate({ id: image.id, tags: (tags ?? image.tags.join(', ')).split(',').map(x => x.trim()).filter(Boolean) }, { onSuccess: () => {
                            setTags(null);
                            toast('Tags saved.');
                        }, onError: toastError });
                    }}
                >
                    <Labeled label="Tags" hint="Comma separated; a search finds them." className="flex-1">
                        <Input value={tags ?? image.tags.join(', ')} onChange={event => setTags(event.target.value)} aria-label="Tags" className="w-full" />
                    </Labeled>
                    <Button variant="secondary" type="submit" disabled={edit.isPending || tags === null}>Save tags</Button>
                </form>
            )}
            {renamable && (
                <form
                    className="flex items-end gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (!name || name === image.name) return;

                        edit.mutate({ id: image.id, name }, {
                            onSuccess: (renamed) => {
                                setName(null);
                                toast(`Renamed to ${renamed.path}.`);
                            },
                            onError: (failure) => {
                                const uses = failure instanceof ApiError ? (failure.body?.usedOn as MediaUse[] | undefined) : undefined;

                                if (uses) setInUse(uses);
                                toastError(failure);
                            },
                        });
                    }}
                >
                    <Labeled label="Name" hint="Its folder stays; something showing it keeps it from a rename." className="flex-1">
                        <Input value={name ?? image.name} onChange={event => setName(event.target.value)} aria-label="Name" className="w-full font-mono" />
                    </Labeled>
                    <Button variant="secondary" icon={<Pencil />} type="submit" disabled={edit.isPending || !name || name === image.name}>Rename</Button>
                </form>
            )}
            {deletable && (
                <Button variant="ghost" icon={<Trash2 />} className="self-start" disabled={del.isPending} onClick={remove}>Delete</Button>
            )}
            {inUse && (
                <div className="rounded-lg border border-line bg-subtle p-3 text-sm" role="alert" data-testid="media-in-use">
                    <p className="mb-2">Shown on these: change them first.</p>
                    <UsedOnList uses={inUse} />
                </div>
            )}
        </div>
    );
};

/** Files dropped or chosen, the folder under the image library they go to (or the catalog pictures), sent at once. */
const UploadBar = ({ onUploaded }: { onUploaded: (ids: string[]) => void }) => {
    const upload = useUploadMedia();
    const input = useRef<HTMLInputElement>(null);
    const [ folder, setFolder ] = useState('web_promo');
    const [ kind, setKind ] = useState('library');

    const send = (files: File[]) => {
        if (files.length === 0) return;

        upload.mutate({ files, folder, kind: kind === 'library' ? '' : CATALOG_PICTURE }, {
            onSuccess: (result) => {
                if (result.items.length) toast(`Uploaded ${result.items.length} ${result.items.length === 1 ? 'image' : 'images'}. Publish the assets for players to see them.`);
                for (const refusal of result.refused) toastError(new Error(`${refusal.file}: ${refusal.why}`));
                onUploaded(result.items.map(x => x.id));
            },
            onError: toastError,
        });
    };

    return (
        <div className="flex flex-wrap items-end gap-3 px-4 py-3" data-testid="media-upload">
            <Labeled label="Upload to">
                <Select value={kind} onChange={event => setKind(event.target.value)} aria-label="Upload to">
                    <option value="library">The image library</option>
                    <option value="catalog">Catalog pictures</option>
                </Select>
            </Labeled>
            {kind === 'library' && (
                <Labeled label="Folder" hint="Under the image library, such as web_promo or web_promo_small.">
                    <Input value={folder} onChange={event => setFolder(event.target.value)} aria-label="Folder" className="font-mono" />
                </Labeled>
            )}
            <Button variant="secondary" icon={<Upload />} disabled={upload.isPending} onClick={() => input.current?.click()}>
                {upload.isPending ? 'Uploading…' : 'Choose images'}
            </Button>
            <span className="text-xs text-muted">or drop them anywhere on this page. PNG, GIF, JPEG or WebP, at most 4 MB each.</span>
            <input
                ref={input}
                type="file"
                multiple
                accept={ACCEPT}
                aria-label="Upload images"
                className="sr-only"
                onChange={(event) => {
                    const files = [ ...event.target.files ?? [] ];

                    event.target.value = '';
                    send(files);
                }}
            />
            <DropTarget onFiles={send} />
        </div>
    );
};

/** The whole page takes dropped files while one is dragged over it. */
const DropTarget = ({ onFiles }: { onFiles: (files: File[]) => void }) => {
    const [ over, setOver ] = useState(false);

    useWindowDrag(setOver, onFiles);

    return over ? <div className="pointer-events-none fixed inset-0 z-40 grid place-items-center bg-accent/10 text-lg font-medium text-accent">Drop to upload</div> : null;
};

const useWindowDrag = (setOver: (over: boolean) => void, onFiles: (files: File[]) => void) => {
    const ref = useRef({ setOver, onFiles });

    useEffect(() => {
        ref.current = { setOver, onFiles };
    });

    useEffect(() => {
        const hasFiles = (event: globalThis.DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;
        const over = (event: globalThis.DragEvent) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            ref.current.setOver(true);
        };
        const leave = (event: globalThis.DragEvent) => {
            if (!event.relatedTarget) ref.current.setOver(false);
        };
        const drop = (event: globalThis.DragEvent) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            ref.current.setOver(false);
            ref.current.onFiles([ ...event.dataTransfer?.files ?? [] ]);
        };

        window.addEventListener('dragover', over);
        window.addEventListener('dragleave', leave);
        window.addEventListener('drop', drop);

        return () => {
            window.removeEventListener('dragover', over);
            window.removeEventListener('dragleave', leave);
            window.removeEventListener('drop', drop);
        };
    }, []);
};

/**
 * Gamedata > Media library: every image the hotel can show - the image library, the asset folder's
 * pictures, the client's own images, plugins' images and uploads - searched by name, path or tag,
 * filtered, and each opened to copy what a field stores for it and see where it is shown.
 */
export const MediaLibraryPage = () => {
    const [ params, setParams ] = useSearchParams();
    const [ text, setText ] = useState(params.get('q') ?? '');
    const [ kind, setKind ] = useState('');
    const [ source, setSource ] = useState('');
    const [ used, setUsed ] = useState<'all' | 'used' | 'unused'>('all');
    const [ sort, setSort ] = useState<NonNullable<MediaQuery['sort']>>('name');
    const [ page, setPage ] = useState(0);
    const [ view, setView ] = useState<'grid' | 'list'>('grid');
    const selected = params.get('id');
    const q = useDebounced(text.trim());
    const query: MediaQuery = { q, kind, source, used, sort, desc: sort !== 'name', page, size: PAGE_SIZE };
    const { data, error, isFetching } = useMediaSearch(query);

    const select = (id: string | null) => setParams((current) => {
        const next = new URLSearchParams(current);

        if (id) next.set('id', id);
        else next.delete('id');

        return next;
    });

    const drop = (event: DragEvent) => event.preventDefault();

    return (
        <>
            <PageHeader title="Media library" description="Every image the hotel can show: the image library, catalog pictures and icons, badges, furniture icons, the client's own images, plugins' images and uploads. Open one to copy what a field stores and see where it is shown." />
            <PageBody className="flex flex-col gap-4">
                <div onDragOver={drop}>
                    <Panel title="Find" actions={<span className="text-xs text-muted">{isFetching ? 'Searching…' : data ? `${data.total} found` : ''}</span>}>
                        <div className="flex flex-col gap-3 px-4 py-3">
                            <div className="flex flex-wrap items-end gap-3">
                                <SearchInput
                                    value={text}
                                    onValueChange={(value) => {
                                        setText(value);
                                        setPage(0);
                                    }}
                                    placeholder="Name, path or tag: summer, web_promo, icon_12"
                                    aria-label="Search images"
                                    className="min-w-64 flex-1"
                                />
                                <Labeled label="Source">
                                    <Select
                                        value={source}
                                        onChange={(event) => {
                                            setSource(event.target.value);
                                            setPage(0);
                                        }}
                                        aria-label="Source"
                                    >
                                        <option value="">Any</option>
                                        {Object.entries(data?.facets.sources ?? {}).map(([ key, count ]) => <option key={key} value={key}>{`${SOURCE_LABELS[key] ?? key} (${count})`}</option>)}
                                    </Select>
                                </Labeled>
                                <Segmented
                                    label="Shown"
                                    value={used}
                                    onChange={(value) => {
                                        setUsed(value as typeof used);
                                        setPage(0);
                                    }}
                                    options={[ { value: 'all', label: 'All' }, { value: 'used', label: 'Used' }, { value: 'unused', label: 'Not used' } ]}
                                />
                                <Labeled label="Sort">
                                    <Select value={sort} onChange={event => setSort(event.target.value as typeof sort)} aria-label="Sort">
                                        <option value="name">Path</option>
                                        <option value="modified">Newest</option>
                                        <option value="size">Largest</option>
                                        <option value="used">Most used</option>
                                    </Select>
                                </Labeled>
                                <div className="flex gap-1">
                                    <IconButton label="Thumbnails" icon={<LayoutGrid />} onClick={() => setView('grid')} className={cx(view === 'grid' && 'bg-subtle')} />
                                    <IconButton label="List" icon={<List />} onClick={() => setView('list')} className={cx(view === 'list' && 'bg-subtle')} />
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                <Chip
                                    active={kind === ''}
                                    onClick={() => {
                                        setKind('');
                                        setPage(0);
                                    }}
                                >Every kind
                                </Chip>
                                {Object.entries(data?.facets.kinds ?? {}).map(([ key, count ]) => (
                                    <Chip
                                        key={key}
                                        active={kind === key}
                                        onClick={() => {
                                            setKind(key);
                                            setPage(0);
                                        }}
                                    >{`${KIND_LABELS[key] ?? key} ${count}`}
                                    </Chip>
                                ))}
                            </div>
                        </div>
                        {data?.canManage && <UploadBar onUploaded={(ids) => { if (ids.length === 1) select(ids[0] ?? null); }} />}
                    </Panel>
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <Panel title="Images">
                        {error && <ErrorNotice error={error} />}
                        {!data && !error && <Loading />}
                        {data && data.items.length === 0 && <EmptyState>No image matches.</EmptyState>}
                        {data && view === 'grid' && (
                            <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2 p-3" data-testid="media-grid">
                                {data.items.map(image => (
                                    <li key={image.id}>
                                        <button
                                            type="button"
                                            onClick={() => select(image.id)}
                                            title={image.path}
                                            className={cx('flex w-full flex-col gap-1 rounded-lg p-1.5 text-left hover:bg-subtle', selected === image.id && 'bg-accent/10 ring-2 ring-accent')}
                                        >
                                            <MediaThumb image={image} className="h-24 w-full" />
                                            <span className="truncate text-xs">{image.name}</span>
                                            <span className="truncate text-[11px] text-muted">{image.usedCount ? `Used ${image.usedCount}x` : 'Not used'}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {data && view === 'list' && (
                            <ul className="divide-y divide-line" data-testid="media-list">
                                {data.items.map(image => (
                                    <li key={image.id}>
                                        <button type="button" onClick={() => select(image.id)} className={cx('flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-subtle', selected === image.id && 'bg-accent/10')}>
                                            <MediaThumb image={image} className="size-10" />
                                            <code className="min-w-0 flex-1 truncate font-mono text-xs">{image.path}</code>
                                            <span className="w-28 text-xs text-muted">{KIND_LABELS[image.kind] ?? image.kind}</span>
                                            <span className="w-20 text-xs text-muted">{image.width && image.height ? `${image.width}x${image.height}` : ''}</span>
                                            <span className="w-16 text-right text-xs text-muted">{sizeOf(image.bytes)}</span>
                                            <span className="w-16 text-right text-xs text-muted">{image.usedCount ? `${image.usedCount}x` : '-'}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {data && data.total > PAGE_SIZE && (
                            <div className="px-4 py-3">
                                <Pagination offset={page * PAGE_SIZE} limit={PAGE_SIZE} total={data.total} onChange={offset => setPage(Math.floor(offset / PAGE_SIZE))} />
                            </div>
                        )}
                    </Panel>
                    <Panel title="Image">
                        {selected
                            ? <Detail key={selected} id={selected} canManage={data?.canManage ?? false} onGone={() => select(null)} />
                            : <EmptyState>Pick an image to see it, copy what a field stores and where it is shown.</EmptyState>}
                    </Panel>
                </div>
            </PageBody>
        </>
    );
};
