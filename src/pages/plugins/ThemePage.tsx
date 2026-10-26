import { Copy, ExternalLink, ImageIcon, Package, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';

import { useClientAssets } from '#/api/assets';
import { type PluginImage, type PluginStyle, useImageChange, usePluginImages, usePluginStyles, useStyleChange } from '#/api/noCode';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel } from '#/components/ui';

import { PackageDialog } from './PackageDialog';

/** `#rrggbb` (or `#aarrggbb`) as the browser's colour picker takes it: its last six digits. */
const pickerValue = (value: string) => /^#[0-9a-f]{6,8}$/i.test(value) ? `#${value.slice(-6)}` : '#000000';

const IMAGE_TYPES = 'image/png,image/gif,image/jpeg,image/webp';

/** What a style with no value shows: the base theme's are the client's own, Habbo's look. */
const CLIENTS_OWN = 'Habbo\'s own';

const copy = (text: string) => void navigator.clipboard.writeText(text).then(() => toast(`Copied ${text}`));

/** One style: its picker, what the hotel has, and Reset back to the theme's default. */
const StyleRow = ({ pluginKey, style, canManage, images }: { pluginKey: string; style: PluginStyle; canManage: boolean; images: PluginImage[] }) => {
    const [ value, setValue ] = useState(style.value ?? '');
    const change = useStyleChange(pluginKey);
    const dirty = value !== (style.value ?? '');
    const said = { onSuccess: () => toast(`${style.label ?? style.name}: saved.`), onError: toastError };
    const target = style.overlay ?? (style.variable.length > 0 ? style.variable.join(' > ') : null);

    return (
        <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-col sm:w-72">
                <span className="flex items-center gap-2 font-medium">
                    {style.label ?? style.name}
                    {style.changed && <Badge tone="amber">changed</Badge>}
                </span>
                <span className="truncate font-mono text-xs text-muted" title={target ?? undefined}>{`\${style:${style.name}}`}{target ? ` - ${target}` : ''}</span>
                {style.hint && <span className="text-xs text-muted">{style.hint}</span>}
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
                {style.type === 'color' && (
                    <>
                        <input type="color" aria-label={`${style.name} colour`} value={pickerValue(value)} disabled={!canManage} onChange={event => setValue(event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent" />
                        <Input aria-label={style.name} value={value} placeholder={CLIENTS_OWN} disabled={!canManage} onChange={event => setValue(event.target.value)} className="w-32 font-mono" />
                    </>
                )}
                {style.type === 'number' && <Input type="number" aria-label={style.name} value={value} min={style.min ?? undefined} max={style.max ?? undefined} disabled={!canManage} onChange={event => setValue(event.target.value)} className="w-32" />}
                {style.type === 'position' && <Input aria-label={style.name} value={value} placeholder={`x,y - ${CLIENTS_OWN}`} disabled={!canManage} onChange={event => setValue(event.target.value)} className="w-40 font-mono" />}
                {(style.type === 'font' || style.type === 'text') && <Input aria-label={style.name} value={value} placeholder={CLIENTS_OWN} disabled={!canManage} onChange={event => setValue(event.target.value)} className="w-64" style={style.type === 'font' ? { fontFamily: value } : undefined} />}
                {style.type === 'image' && (
                    <>
                        {style.value && /^(\/|https?:)/.test(style.value) && <img src={style.value} alt="" className="max-h-12 max-w-32 rounded border border-line bg-subtle object-contain" />}
                        {style.value && <span className="max-w-72 truncate font-mono text-xs text-muted" title={style.value}>{style.value}</span>}
                        {canManage && (
                            <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-accent hover:underline">
                                <Upload className="size-4" />
                                Upload
                                <input
                                    type="file"
                                    accept={IMAGE_TYPES}
                                    className="sr-only"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];

                                        if (file) change.mutate({ name: style.name, file }, said);
                                    }}
                                />
                            </label>
                        )}
                        {canManage && images.length > 0 && (
                            <select
                                aria-label={`${style.name} image`}
                                value=""
                                className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                                onChange={(event) => {
                                    if (event.target.value) change.mutate({ name: style.name, value: event.target.value }, said);
                                }}
                            >
                                <option value="">Pick an uploaded image</option>
                                {images.map(image => <option key={image.path} value={image.path}>{image.path}</option>)}
                            </select>
                        )}
                    </>
                )}
                {style.type !== 'image' && canManage && <Button icon={<Save />} disabled={!dirty || value.trim() === '' || change.isPending} onClick={() => change.mutate({ name: style.name, value }, said)}>Save</Button>}
                {style.changed && canManage && (
                    <Button
                        variant="ghost"
                        icon={<RotateCcw />}
                        disabled={change.isPending}
                        title={`The theme's default: ${style.default ?? CLIENTS_OWN}`}
                        onClick={() => change.mutate({ name: style.name, value: null }, { onSuccess: (reset) => {
                            setValue(reset.value ?? '');
                            toast(`${style.label ?? style.name}: back to ${style.default === null ? CLIENTS_OWN : `the theme's ${style.default}`}.`);
                        }, onError: toastError })}
                    >
                        Reset
                    </Button>
                )}
                {!style.changed && <span className="text-xs text-muted">{style.default === null ? CLIENTS_OWN : 'the theme\'s default'}</span>}
            </div>
        </li>
    );
};

/**
 * The plugin's images (its `wwwroot/styles/`): upload one, see each with the path a patch or an image
 * style names it by and the address a variable names it by, and take one away.
 */
const ImagesPanel = ({ pluginKey }: { pluginKey: string }) => {
    const { data, error } = usePluginImages(pluginKey);
    const change = useImageChange(pluginKey);

    return (
        <Panel
            title="Images"
            description={`Kept in ${pluginKey === 'hotel' ? 'plugins/hotel' : 'the plugin\'s'}/wwwroot/styles/. A patch's "asset" and an image style take the path; a variable (asset.overlays) takes the address.`}
        >
            {error && <ErrorNotice error={error} />}
            {!data && !error && <Loading />}
            {data?.canManage && (
                <div className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-accent hover:underline">
                        <Upload className="size-4" />
                        Upload an image (PNG, GIF, JPEG or WebP, at most 2 MB)
                        <input
                            type="file"
                            accept={IMAGE_TYPES}
                            aria-label="Upload an image"
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.target.files?.[0];

                                event.target.value = '';

                                if (file) change.mutate({ file }, { onSuccess: image => toast(`Uploaded ${image!.path}.`), onError: toastError });
                            }}
                        />
                    </label>
                </div>
            )}
            {data && data.images.length === 0 && <EmptyState>No images yet.</EmptyState>}
            <ul className="divide-y divide-line">
                {data?.images.map(image => (
                    <li key={image.path} className="flex flex-wrap items-center gap-3 px-4 py-2">
                        {image.url ? <img src={image.url} alt="" className="max-h-12 max-w-24 rounded border border-line bg-subtle object-contain" /> : <ImageIcon className="size-6 text-muted" />}
                        <code className="font-mono text-sm">{image.path}</code>
                        <Button variant="ghost" icon={<Copy />} onClick={() => copy(image.path)}>Path</Button>
                        {image.url && <Button variant="ghost" icon={<Copy />} onClick={() => copy(image.url!)}>Address</Button>}
                        <span className="text-xs text-muted">{`${Math.ceil(image.bytes / 1024)} KB`}</span>
                        {data.canManage && (
                            <Button variant="ghost" icon={<Trash2 />} className="ml-auto" disabled={change.isPending} onClick={() => change.mutate({ path: image.path }, { onSuccess: () => toast(`Removed ${image.path}.`), onError: toastError })}>
                                Remove
                            </Button>
                        )}
                    </li>
                ))}
            </ul>
        </Panel>
    );
};

/**
 * A theme's style properties (its `theme.json`, and those of the theme it extends) with the hotel's
 * values: staff change a colour, size, image or font once and every patch naming it follows, at each
 * player's next load. The hotel's own plugin extends the base theme, Habbo's look.
 */
export const ThemePage = () => {
    const { key = '' } = useParams();
    const { data, error } = usePluginStyles(key);
    const images = usePluginImages(key).data?.images ?? [];
    const assets = useClientAssets();
    const [ packaging, setPackaging ] = useState(false);
    const groups = Map.groupBy(data?.styles ?? [], style => style.group ?? 'Styles');
    const client = assets?.preview ? assets.preview.replace(/[?&]preview\b.*$/, '') : null;

    return (
        <>
            <PageHeader title={`Theme: ${key}`} description="Its style properties, as its theme.json declares them (and the theme it extends), and this hotel's values. Players see a change at their next load." back={{ to: '/plugins', label: 'Plugins' }}>
                {client && (
                    <Button variant="secondary" icon={<ExternalLink />} onClick={() => window.open(client, '_blank', 'noopener')}>
                        Preview in the client
                    </Button>
                )}
                {data?.canManage && (
                    <Button variant="secondary" icon={<Package />} onClick={() => setPackaging(true)}>
                        Make a plugin
                    </Button>
                )}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!data && !error && <Loading />}
                {data && data.styles.length === 0 && <EmptyState framed>This plugin declares no style properties: it has no theme.json (one with &quot;extends&quot;: &quot;habbo&quot; gets Habbo&apos;s).</EmptyState>}
                {[ ...groups ].map(([ group, styles ]) => (
                    <Panel key={group} title={group}>
                        <ul className="divide-y divide-line">
                            {styles.map(style => <StyleRow key={`${style.name}-${style.value}`} pluginKey={key} style={style} canManage={data!.canManage} images={images} />)}
                        </ul>
                    </Panel>
                ))}
                {key && <ImagesPanel pluginKey={key} />}
                {data && data.styles.length > 0 && (
                    <Labeled label="In a patch" hint="A value that is a whole style takes its type (a colour stays a number); inside text it is written in. A style that is Habbo's own has no value for a patch to read.">
                        <code className="rounded bg-subtle px-2 py-1 font-mono text-xs">{`{ "element": "help_button", "set": { "color": "\${style:${(data.styles.find(style => style.type === 'color') ?? data.styles[0]!).name}}" } }`}</code>
                    </Labeled>
                )}
            </PageBody>
            <PackageDialog pluginKey={key} open={packaging} onClose={() => setPackaging(false)} />
        </>
    );
};
