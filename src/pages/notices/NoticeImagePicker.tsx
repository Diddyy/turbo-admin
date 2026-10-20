import { ImageOff, Search, TriangleAlert, Upload, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { catalogImageUrl, useClientAssets } from '#/api/assets';
import { useUploadCatalogImage } from '#/api/catalogImages';
import { useClientImages, useClientImageUrl } from '#/api/notices';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, Input, Segmented } from '#/components/ui';
import { cx } from '#/lib/cx';

import { CHECKS } from '../catalog/CatalogImageThumb';
import { isImageAddress, useNoticeImage } from './hooks';

/** How many of the client's images the grid draws at once; typing narrows them. */
const SHOWN = 96;

/** Habbo's notices' own images first, as a start to pick from. */
const SUGGESTED = [ 'reward_track_small_icon', 'cursed_dragon_adoption_icon', 'icons_toolbar_achievements_normal', 'prog_menu_daily_tasks', 'recycler_recycler_icon', 'bottom_bar_wired_menu' ];

type Mode = 'client' | 'address' | 'upload';

const ClientImageTile = ({ name, selected, onPick }: { name: string; selected: boolean; onPick: () => void }) => {
    const url = useClientImageUrl(name);

    return (
        <button
            type="button"
            onClick={onPick}
            title={name}
            aria-label={`Use ${name}`}
            aria-pressed={selected}
            className={cx('flex min-w-0 flex-col items-center gap-1 rounded-lg border p-1.5 text-left hover:border-accent', selected ? 'border-accent bg-accent-soft' : 'border-line')}
        >
            <span className={cx('grid size-12 place-items-center overflow-hidden rounded', CHECKS)}>
                {url && <img src={url} alt="" className="max-h-full max-w-full [image-rendering:pixelated]" />}
            </span>
            <span className="w-full truncate text-center font-mono text-[10px] text-muted">{name}</span>
        </button>
    );
};

/**
 * A notice's picture: one of the client's own images (the `habbo-window-manager-com` bundle's,
 * each drawn), an address (`${image.library.url}` is the client's image library), or a GIF or PNG
 * uploaded as a catalog picture and named by its address. What is picked is drawn beside it as
 * the client would find it, with a warning when the client can't.
 */
export const NoticeImagePicker = ({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) => {
    const image = value.trim();
    const [ mode, setMode ] = useState<Mode>(image && isImageAddress(image) ? 'address' : 'client');
    const [ find, setFind ] = useState('');
    const fileInput = useRef<HTMLInputElement>(null);
    const assets = useClientAssets();
    const { data: images, error, isLoading } = useClientImages();
    const upload = useUploadCatalogImage();
    const current = useNoticeImage(image);

    const shown = useMemo(() => {
        const words = find.trim().toLowerCase();
        const names = images?.names ?? [];

        if (!words) return [ ...SUGGESTED.filter(x => images?.has(x)), ...names.filter(x => !SUGGESTED.includes(x)) ].slice(0, SHOWN);

        return names.filter(x => x.toLowerCase().includes(words)).sort((a, b) => Number(!a.toLowerCase().startsWith(words)) - Number(!b.toLowerCase().startsWith(words))).slice(0, SHOWN);
    }, [ images, find ]);

    const take = (file: File) => upload.mutate({ file, name: '' }, {
        onSuccess: (uploaded) => {
            const url = catalogImageUrl(assets, uploaded.name);

            if (!url) return toastError(new Error('The client\'s catalog picture address isn\'t known, so the upload can\'t be named by it.'));

            onChange(url.startsWith('//') ? `https:${url}` : url);
            toast(`Uploaded ${uploaded.file}. Publish the assets for players to see it.`);
        },
        onError: toastError,
    });

    return (
        <fieldset disabled={disabled} className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-line p-2">
                <span className={cx('grid size-12 shrink-0 place-items-center overflow-hidden rounded', CHECKS)}>
                    {current.url && !current.missing
                        ? <img src={current.url} alt="" onError={current.onError} className="max-h-full max-w-full [image-rendering:pixelated]" />
                        : current.missing ? <TriangleAlert className="size-5 text-warn" /> : <ImageOff className="size-5 text-muted" />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cx('truncate font-mono text-xs', !image && 'font-sans text-muted')} data-testid="notice-image-value">{image || 'No picture'}</span>
                    <span className="flex flex-wrap gap-1">
                        {image && <Badge>{isImageAddress(image) ? 'address' : 'client image'}</Badge>}
                        {current.missing && <Badge tone="amber">{isImageAddress(image) ? 'doesn\'t load' : 'the client has no image by this name'}</Badge>}
                    </span>
                </span>
                {image && (
                    <button type="button" onClick={() => onChange('')} aria-label="No picture" title="No picture" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
                        <X className="size-3.5" />
                    </button>
                )}
            </div>
            <Segmented
                label="Picture from"
                value={mode}
                onChange={value => setMode(value as Mode)}
                options={[ { value: 'client', label: 'Client image' }, { value: 'address', label: 'Address' }, { value: 'upload', label: 'Upload' } ]}
            />
            {mode === 'client' && (
                <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 rounded-lg border border-line bg-canvas px-2.5">
                        <Search className="size-4 shrink-0 text-muted" aria-hidden />
                        <input
                            aria-label="Find a client image"
                            value={find}
                            onChange={event => setFind(event.target.value)}
                            placeholder={images ? `Find among ${images.names.length.toLocaleString()} client images` : 'Loading the client\'s images…'}
                            spellCheck={false}
                            className="h-8 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted/70"
                        />
                    </label>
                    {error && <p className="text-xs text-bad">The client&apos;s images couldn&apos;t be read: {error.message}</p>}
                    {!assets?.templates && !isLoading && <p className="text-xs text-muted">The hotel&apos;s variables name no asset.bundles.templates, so the client&apos;s images can&apos;t be listed. A name typed as an address&apos;s alternative still works.</p>}
                    <div className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-1.5 overflow-y-auto" data-testid="client-images">
                        {shown.map(name => <ClientImageTile key={name} name={name} selected={name === image} onPick={() => onChange(name)} />)}
                    </div>
                    {images && shown.length === 0 && <p className="text-xs text-muted">No client image by that name.</p>}
                    {find.trim() && !images?.has(find.trim()) && (
                        <Button variant="ghost" className="self-start" onClick={() => onChange(find.trim())}>Use the name {find.trim()} anyway</Button>
                    )}
                </div>
            )}
            {mode === 'address' && (
                <Input
                    aria-label="Picture address"
                    value={isImageAddress(image) ? image : ''}
                    onChange={event => onChange(event.target.value)}
                    placeholder="${image.library.url}album1584/ACH_LegDay20.png or https://…"
                    className="font-mono"
                />
            )}
            {mode === 'upload' && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="secondary" icon={<Upload />} disabled={upload.isPending || !assets?.catalogImage} onClick={() => fileInput.current?.click()}>
                        {upload.isPending ? 'Uploading…' : 'Upload a GIF or PNG'}
                    </Button>
                    <span className="text-xs text-muted">Kept with the catalog pictures and named by its address there; players see it once the assets are published.</span>
                    <input
                        ref={fileInput}
                        type="file"
                        accept="image/gif,image/png"
                        className="sr-only"
                        onChange={(event) => {
                            const file = event.target.files?.[0];

                            if (file) take(file);

                            event.target.value = '';
                        }}
                    />
                </div>
            )}
        </fieldset>
    );
};
