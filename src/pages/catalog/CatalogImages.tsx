import { Images, RefreshCw, Trash2, Upload } from 'lucide-react';
import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { type CatalogTree } from '#/api/catalog';
import { type CatalogImage, type CatalogImageShow, useCatalogImages, useDeleteCatalogImage, useUploadCatalogImage } from '#/api/catalogImages';
import { ask } from '#/components/confirm';
import { Modal } from '#/components/Modal';
import { Pagination } from '#/components/Pagination';
import { SearchInput } from '#/components/SearchInput';
import { toast, toastError } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Segmented } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useDebounced } from '#/lib/debounce';

import { CatalogImageThumb, CHECKS } from './CatalogImageThumb';

const PAGE_SIZE = 60;

const SHOWS: { value: CatalogImageShow; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'unused', label: 'Not used' },
];

/** A file's name as a picture's: without its extension, and only the characters a name may hold. */
const nameOfFile = (file: string) => file.replace(/\.(gif|png)$/i, '').replace(/[^\w.-]+/g, '_');

const sizeOf = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`);

/** The pages that show a picture, each a link to open it; a picture none shows says so. */
const ShownOn = ({ image, onOpenPage }: { image: CatalogImage; onOpenPage: (id: number) => void }) => {
    if (image.pages.length === 0)
        return <span className="text-muted">On no page</span>;

    return (
        <span className="line-clamp-2">
            On
            {' '}
            {image.pages.slice(0, 2).map((page, i) => (
                <span key={page.id}>
                    {i > 0 && ', '}
                    <button type="button" onClick={() => onOpenPage(page.id)} className="text-accent hover:underline">{page.title}</button>
                </span>
            ))}
            {image.pages.length > 2 && <span title={image.pages.slice(2).map(x => x.title).join(', ')}>{` and ${image.pages.length - 2} more`}</span>}
        </span>
    );
};

const ImageCard = ({ image, canManage, onOpenPage, onReplace, onDelete }: { image: CatalogImage; canManage: boolean; onOpenPage: (id: number) => void; onReplace: () => void; onDelete: () => void }) => (
    <li className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
        <CatalogImageThumb image={image} className="h-32 w-full rounded-none border-0 border-b p-2" />
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-2.5 text-xs">
            <span title={image.file} className="line-clamp-2 font-mono text-[13px] break-all text-ink">{image.name}</span>
            <span className="text-muted">{`${image.file.endsWith('.png') ? 'PNG' : 'GIF'} · ${sizeOf(image.size)}`}</span>
            <ShownOn image={image} onOpenPage={onOpenPage} />
            {canManage && (
                <div className="mt-auto flex items-center gap-1 pt-1">
                    <Button variant="ghost" icon={<RefreshCw />} onClick={onReplace} className="h-8 flex-1 justify-start px-2 sm:h-7">
                        Replace
                    </Button>
                    <IconButton label={`Delete ${image.name}`} icon={<Trash2 />} tone="bad" small onClick={onDelete} />
                </div>
            )}
        </div>
    </li>
);

/**
 * Uploading a picture: a GIF or PNG dropped or chosen, named as its file unless named otherwise,
 * shown before it goes. Replacing one starts with its name, which stays.
 */
const UploadDialog = ({ open, name: fixedName, taken, onClose }: { open: boolean; name: string | null; taken: (name: string) => boolean; onClose: () => void }) => {
    const [ file, setFile ] = useState<File | null>(null);
    const [ name, setName ] = useState(fixedName ?? '');
    const [ over, setOver ] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const upload = useUploadCatalogImage();

    const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [ file ]);

    // The chosen file's address goes with it.
    useEffect(() => () => {
        if (preview)
            URL.revokeObjectURL(preview);
    }, [ preview ]);

    const choose = (picked: File | undefined) => {
        if (!picked)
            return;

        setFile(picked);

        if (!fixedName)
            setName(nameOfFile(picked.name));
    };

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        setOver(false);
        choose(event.dataTransfer.files[0]);
    };

    const trimmed = name.trim();
    const replaces = !fixedName && trimmed !== '' && taken(trimmed);

    const submit = () => {
        if (!file || !trimmed)
            return;

        upload.mutate({ file, name: trimmed }, {
            onSuccess: (image) => {
                toast(`Uploaded ${image.file}. Publish the assets for players to see it.`);
                onClose();
            },
            onError: toastError,
        });
    };

    return (
        <Modal title={fixedName ? `Replace ${fixedName}` : 'Upload a picture'} open={open} onClose={onClose} className="sm:max-w-lg">
            <form
                className="flex flex-col gap-4 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <button
                    type="button"
                    onClick={() => input.current?.click()}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setOver(true);
                    }}
                    onDragLeave={() => setOver(false)}
                    onDrop={onDrop}
                    className={cx(
                        'grid min-h-44 place-items-center rounded-xl border-2 border-dashed p-3 text-sm text-muted transition-colors',
                        over ? 'border-accent bg-accent-soft' : 'border-line hover:border-muted/60',
                        preview && CHECKS,
                    )}
                >
                    {preview
                        ? <img src={preview} alt="" className="max-h-60 max-w-full object-contain [image-rendering:pixelated]" />
                        : (
                                <span className="flex flex-col items-center gap-2">
                                    <Upload className="size-6" />
                                    Drop a GIF or PNG here, or choose one
                                </span>
                            )}
                </button>
                <input ref={input} type="file" accept="image/gif,image/png" className="sr-only" onChange={event => choose(event.target.files?.[0])} />
                {!fixedName && (
                    <Labeled label="Name" hint={replaces ? 'A picture has this name: this replaces it.' : 'What a page gives to show it. The client loads it as the name with .gif after it.'}>
                        <Input value={name} onChange={event => setName(event.target.value)} spellCheck={false} placeholder="catalog_header_mine" className="w-full font-mono" />
                    </Labeled>
                )}
                {file && <p className="text-xs text-muted">{`${file.name} · ${sizeOf(file.size)}`}</p>}
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" icon={<Upload />} disabled={!file || !trimmed || upload.isPending}>{upload.isPending ? 'Uploading…' : replaces || fixedName ? 'Replace' : 'Upload'}</Button>
                </div>
            </form>
        </Modal>
    );
};

/**
 * The catalog's pictures - the headers and teasers its pages show - as the files in the server's
 * catalog pictures folder, each with the pages that show it. An upload goes into the folder and
 * reaches players once the assets are published.
 */
export const CatalogImages = ({ tree, onOpenPage }: { tree: CatalogTree; onOpenPage: (id: number) => void }) => {
    const [ text, setText ] = useState('');
    const [ show, setShow ] = useState<CatalogImageShow>('all');
    const [ page, setPage ] = useState(0);
    const [ uploading, setUploading ] = useState<{ name: string | null } | null>(null);
    const q = useDebounced(text.trim());
    const result = useCatalogImages({ q, show, page, size: PAGE_SIZE });
    const remove = useDeleteCatalogImage();
    const data = result.data;
    const items = data?.items ?? [];

    const doDelete = (image: CatalogImage) => {
        ask({
            title: `Delete ${image.name}?`,
            body: image.pages.length > 0
                ? `${image.pages.length === 1 ? 'A page shows' : `${image.pages.length} pages show`} it; they'll show nothing there. A picture from Habbo is taken again by the next sync while a page names it.`
                : 'Its file goes from this server. Published copies stay until the assets are published again.',
            confirm: 'Delete',
            danger: true,
        }, () => remove.mutate(image.name, {
            onSuccess: () => toast(`Deleted ${image.name}.`),
            onError: toastError,
        }));
    };

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                    value={text}
                    onValueChange={(value) => {
                        // A new search starts from its first page.
                        setText(value);
                        setPage(0);
                    }}
                    placeholder="Find a picture"
                    aria-label="Find a picture"
                    className="w-full sm:w-64"
                />
                <div className="w-full sm:w-auto sm:min-w-80">
                    <Segmented
                        label="Which pictures"
                        value={show}
                        onChange={(value) => {
                            setShow(value as CatalogImageShow);
                            setPage(0);
                        }}
                        options={SHOWS}
                    />
                </div>
                {tree.canManage && (
                    <Button icon={<Upload />} onClick={() => setUploading({ name: null })} className="sm:ml-auto">Upload</Button>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="flex items-center gap-2 font-medium">
                    <Images className="size-4 text-accent" />
                    {data ? `${data.total.toLocaleString()} ${data.total === 1 ? 'picture' : 'pictures'}` : '…'}
                </span>
                <span className="text-xs text-muted">
                    Uploads reach players once the assets are
                    {' '}
                    <Link to="/gamedata/publish" className="text-accent hover:underline">published</Link>
                    .
                </span>
                <span className="ml-auto">
                    {data && <Pagination offset={page * PAGE_SIZE} limit={PAGE_SIZE} total={data.total} onChange={offset => setPage(Math.floor(offset / PAGE_SIZE))} />}
                </span>
            </div>

            {result.error && <ErrorNotice error={result.error} />}
            {result.isPending && <Loading />}
            {data && items.length === 0 && (
                <EmptyState framed icon={<Images />}>
                    {q ? `No picture's name holds “${q}”.` : show === 'unused' ? 'Every picture is on a page.' : 'The catalog pictures folder is empty. Upload one, or a sync takes those the pages name from Habbo.'}
                </EmptyState>
            )}
            {items.length > 0 && (
                <ul className={cx('grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3', result.isPlaceholderData && 'opacity-60')}>
                    {items.map(image => (
                        <ImageCard
                            key={image.file}
                            image={image}
                            canManage={tree.canManage}
                            onOpenPage={onOpenPage}
                            onReplace={() => setUploading({ name: image.name })}
                            onDelete={() => doDelete(image)}
                        />
                    ))}
                </ul>
            )}

            {uploading && (
                <UploadDialog
                    key={uploading.name ?? 'new'}
                    open
                    name={uploading.name}
                    taken={name => items.some(x => x.name === name)}
                    onClose={() => setUploading(null)}
                />
            )}
        </div>
    );
};
