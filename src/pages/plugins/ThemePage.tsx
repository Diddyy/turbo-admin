import { Copy, ExternalLink, ImageIcon, Package, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { useClientAssets } from '#/api/assets';
import { FONT_TYPES, type PluginFont, type PluginStyle, useFontChange, useImageChange, usePluginFonts, usePluginImages, usePluginStyles, useStyleChange } from '#/api/noCode';
import { type TemplateIndex, useTemplateIndex } from '#/api/windows';
import { ImageInput } from '#/components/ImageInput';
import { useSaved } from '#/components/SaveFeedback';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel, Select } from '#/components/ui';
import { ThemePicker } from '#/pages/appearance/ThemePicker';
import { type DesignDraft, DesignPreview } from '#/preview/DesignPreview';
import { designTemplateOfFrame } from '#/preview/designSamples';

import { PackageDialog } from './PackageDialog';

/** `#rrggbb` (or `#aarrggbb`) as the browser's colour picker takes it: its last six digits. */
const pickerValue = (value: string) => /^#[0-9a-f]{6,8}$/i.test(value) ? `#${value.slice(-6)}` : '#000000';

const IMAGE_TYPES = 'image/png,image/gif,image/jpeg,image/webp';

/** The faces the client ships, which a font style names as they are (nitro-next `docs/text.md`). */
const SHIPPED_FONTS = [ 'Ubuntu', 'UbuntuCondensed', 'Volter', 'Volter Bold' ];

/** What a style with no value shows: the base theme's are the client's own, Habbo's look. */
const CLIENTS_OWN = 'Habbo\'s own';

/** What each area of the base theme's styles restyles, said under its heading. */
const GROUP_HINTS: Record<string, string> = {
    Windows: 'The frame, title bar and colour most windows are drawn with: catalogue, inventory, navigator.',
    Purse: 'The purse at the top right: its border art.',
    Catalogue: 'The catalogue window: its colour and where it first opens.',
    Navigator: 'The navigator window: its colour and where it first opens.',
    Fonts: 'The typefaces windows and chat are written in.',
    'Loading screen': 'What players see while the hotel loads: the picture, the bar and the words.',
};

/** Whose default a style goes back to: Habbo's own (the base theme's, or the client's) or that of the theme that set one. */
const resetTo = (style: PluginStyle) => (style.origin === 'habbo' || style.origin === null ? CLIENTS_OWN : `${style.origin}'s default`);

const copy = (text: string) => void navigator.clipboard.writeText(text).then(() => toast(`Copied ${text}`));

/** A typed value as the client reads it (turbo-cloud `ThemeStyles.ClientValue`): in `templates.styles`, and in the variable it also goes to. Undefined while it is no value yet. */
const clientValues = (style: PluginStyle, value: string): { style: unknown; variable: unknown } | undefined => {
    const text = value.trim();

    if (style.type === 'color') {
        const hex = /^#?([0-9a-f]{6}|[0-9a-f]{8})$/i.exec(text)?.[1];

        if (!hex) return undefined;

        const argb = (hex.length === 6) ? (0xFF000000 + Number.parseInt(hex, 16)) : Number.parseInt(hex, 16);

        return { style: argb, variable: `#${hex.slice(-6).toLowerCase()}` };
    }

    if (style.type === 'number') return (text !== '' && Number.isFinite(Number(text))) ? { style: Number(text), variable: Number(text) } : undefined;

    if (style.type === 'position') {
        const match = /^(-?\d+)\s*,\s*(-?\d+)$/.exec(text);
        const position = match && { x: Number(match[1]), y: Number(match[2]) };

        return position ? { style: position, variable: position } : undefined;
    }

    return ((style.type === 'font') || (style.type === 'text')) && text ? { style: text, variable: text } : undefined;
};

/**
 * The unsaved values as a preview's draft: each in `templates.styles` and in the variable it goes to; a
 * font that was uploaded also its `text.fonts` entry, so the preview loads its file.
 */
const styleDraft = (pluginKey: string, styles: readonly PluginStyle[], values: Readonly<Record<string, string>>, fonts: readonly PluginFont[]): DesignDraft => {
    const draft: Required<Pick<DesignDraft, 'styles' | 'variables'>> = { styles: {}, variables: [] };

    for (const style of styles) {
        const value = values[style.name];
        const client = (value === undefined) ? undefined : clientValues(style, value);

        if (!client) continue;

        draft.styles[`${pluginKey}:${style.name}`] = client.style;

        if (style.variable.length > 1) draft.variables.push({ path: style.variable, value: client.variable });

        const font = (style.type === 'font') ? fonts.find(each => each.family === value?.trim()) : undefined;

        if (font?.url) draft.variables.push({ path: [ 'text.fonts', font.family ], value: font.url });
    }

    return draft;
};

/** The window a style changes, for its preview: the one its `frame.overrides` entry names (a frame Nitro draws, or a template's by its code's frame id). */
const windowOfStyle = (index: TemplateIndex | undefined, style: PluginStyle | undefined) => {
    const name = (style?.variable[0] === 'frame.overrides') ? style.variable[1] : undefined;

    if (!index || !name) return undefined;

    return index.frames[name] ? name : designTemplateOfFrame(name);
};

/** One style: its picker, what the hotel has, and Reset back to the theme's default. */
const StyleRow = ({ pluginKey, style, canManage, fonts, onDraft }: { pluginKey: string; style: PluginStyle; canManage: boolean; fonts: PluginFont[]; onDraft?: (name: string, value: string) => void }) => {
    const [ value, setOwnValue ] = useState(style.value ?? '');
    const setValue = (next: string) => {
        setOwnValue(next);
        onDraft?.(style.name, next);
    };
    const change = useStyleChange(pluginKey);
    const fontChange = useFontChange(pluginKey);
    const saved = useSaved();
    const dirty = value !== (style.value ?? '');
    const said = { onSuccess: () => saved(style.label ?? style.name), onError: toastError };
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
                {style.type === 'font' && canManage && (
                    <>
                        <select
                            aria-label={`${style.name} font`}
                            value=""
                            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
                            onChange={(event) => {
                                if (event.target.value) setValue(event.target.value);
                            }}
                        >
                            <option value="">Pick a font</option>
                            <optgroup label="The client's">{SHIPPED_FONTS.map(face => <option key={face} value={face}>{face}</option>)}</optgroup>
                            {fonts.length > 0 && <optgroup label="Uploaded">{fonts.map(font => <option key={font.path} value={font.family}>{font.family}</option>)}</optgroup>}
                        </select>
                        <label className={`inline-flex items-center gap-1 text-sm text-accent ${fontChange.isPending ? 'opacity-50' : 'cursor-pointer hover:underline'}`}>
                            <Upload className="size-4" />
                            {fontChange.isPending ? 'Uploading...' : 'Upload a font'}
                            <input
                                type="file"
                                accept={FONT_TYPES}
                                aria-label={`Upload a font for ${style.name}`}
                                className="sr-only"
                                disabled={fontChange.isPending}
                                onChange={(event) => {
                                    const file = event.target.files?.[0];

                                    event.target.value = '';

                                    if (file) fontChange.mutate({ file }, { onSuccess: font => font && setValue(font.family), onError: toastError });
                                }}
                            />
                        </label>
                    </>
                )}
                {style.type === 'image' && (
                    <ImageInput
                        value={style.value ?? ''}
                        onChange={next => change.mutate({ name: style.name, value: next || null }, said)}
                        accept={{ shapes: [ 'plugin' ], plugin: pluginKey, usedIn: 'theme.style' }}
                        title={style.label ?? style.name}
                        resolve={path => (/^(\/|https?:)/.test(path) ? path : null)}
                        disabled={!canManage || change.isPending}
                        className="w-full max-w-md"
                    />
                )}
                {style.type !== 'image' && canManage && <Button icon={<Save />} disabled={!dirty || value.trim() === '' || change.isPending} onClick={() => change.mutate({ name: style.name, value }, said)}>Save</Button>}
                {style.changed && canManage && (
                    <Button
                        variant="ghost"
                        icon={<RotateCcw />}
                        disabled={change.isPending}
                        title={`Back to ${resetTo(style)}: ${style.default ?? 'nothing set, the client draws it as Habbo does'}`}
                        onClick={() => change.mutate({ name: style.name, value: null }, { onSuccess: (reset) => {
                            setValue(reset.value ?? '');
                            saved(`${style.label ?? style.name}: back to ${style.default === null ? CLIENTS_OWN : `${resetTo(style)} ${style.default}`}`);
                        }, onError: toastError })}
                    >
                        {`Reset to ${resetTo(style)}`}
                    </Button>
                )}
                {!style.changed && <span className="text-xs text-muted">{style.default === null ? CLIENTS_OWN : resetTo(style)}</span>}
            </div>
        </li>
    );
};

/**
 * The plugin's images (its `wwwroot/styles/`): upload one, see each with the path a patch or an image
 * style names it by and the address a variable names it by, and take one away.
 */
export const ImagesPanel = ({ pluginKey }: { pluginKey: string }) => {
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
 * The plugin's fonts (its `wwwroot/styles/`): upload a WOFF2, WOFF, TrueType or OpenType file and
 * clients load it as the family its name says, which a font style property then picks; take one away
 * with its family.
 */
export const FontsPanel = ({ pluginKey }: { pluginKey: string }) => {
    const { data, error } = usePluginFonts(pluginKey);
    const change = useFontChange(pluginKey);

    return (
        <Panel
            title="Fonts"
            description="A font file is given to players' clients as the family its file name says (pixel.woff2 is pixel): pick it on a font style property (Fonts > Text, Window titles)."
        >
            {error && <ErrorNotice error={error} />}
            {!data && !error && <Loading />}
            {data?.canManage && (
                <div className="px-4 py-3">
                    <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-accent hover:underline">
                        <Upload className="size-4" />
                        Upload a font (WOFF2, WOFF, TTF or OTF, at most 2 MB)
                        <input
                            type="file"
                            accept={FONT_TYPES}
                            aria-label="Upload a font"
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.target.files?.[0];

                                event.target.value = '';

                                if (file) change.mutate({ file }, { onSuccess: font => toast(`Uploaded ${font!.path}: clients load it as ${font!.family}.`), onError: toastError });
                            }}
                        />
                    </label>
                </div>
            )}
            {data && data.fonts.length === 0 && <EmptyState>No fonts yet.</EmptyState>}
            <ul className="divide-y divide-line">
                {data?.fonts.map(font => (
                    <li key={font.path} className="flex flex-wrap items-center gap-3 px-4 py-2">
                        <span className="font-medium">{font.family}</span>
                        <code className="font-mono text-sm text-muted">{font.path}</code>
                        <Button variant="ghost" icon={<Copy />} onClick={() => copy(font.family)}>Family</Button>
                        <span className="text-xs text-muted">{`${Math.ceil(font.bytes / 1024)} KB`}</span>
                        {data.canManage && (
                            <Button variant="ghost" icon={<Trash2 />} className="ml-auto" disabled={change.isPending} onClick={() => change.mutate({ path: font.path }, { onSuccess: () => toast(`Removed ${font.path}.`), onError: toastError })}>
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
    const { key = 'hotel' } = useParams();
    const [ params, setParams ] = useSearchParams();
    const { data, error } = usePluginStyles(key);
    const ownFonts = usePluginFonts(key).data?.fonts;
    const hotelFonts = usePluginFonts('hotel').data?.fonts;
    // The plugin's fonts and the hotel's: each is given to clients as the hotel's text.fonts entry.
    const fonts = useMemo(() => [ ...(ownFonts ?? []), ...(key === 'hotel' ? [] : hotelFonts ?? []) ], [ ownFonts, hotelFonts, key ]);
    const assets = useClientAssets();
    const [ packaging, setPackaging ] = useState(false);
    const all = Map.groupBy(data?.styles ?? [], style => style.group ?? 'Styles');
    const area = params.get('group');
    const groups = [ ...all ].filter(([ name ]) => !area || name === area);
    const client = assets?.preview ? assets.preview.replace(/[?&]preview\b.*$/, '') : null;
    const { data: index } = useTemplateIndex();
    // The values typed and not saved yet, by style name: the preview draws them.
    const [ values, setValues ] = useState<Record<string, string>>({});
    const [ previewed, setPreviewed ] = useState<string | null>(null);
    const styles = useMemo(() => data?.styles ?? [], [ data ]);
    const draft = useMemo(() => styleDraft(key, styles, values, fonts), [ key, styles, values, fonts ]);
    const windows = useMemo(() => [ ...new Set(styles.map(style => windowOfStyle(index, style)).filter(id => id !== undefined)) ], [ index, styles ]);
    const shownWindow = previewed ?? windows[0] ?? null;
    const onDraft = (name: string, value: string) => {
        setValues(current => ({ ...current, [name]: value }));

        const target = windowOfStyle(index, styles.find(style => style.name === name));

        if (target) setPreviewed(target);
    };

    return (
        <>
            <PageHeader title="Style properties" description={`The colours, art, fonts and places a theme names, and this hotel's values${data?.extends ? `: ${key} extends ${data.extends} and has its properties unless it names them again` : ''}. Players see a change at their next load.`}>
                <ThemePicker value={key} to={next => `/appearance/styles/${encodeURIComponent(next)}`} />
                {all.size > 1 && (
                    <label className="inline-flex items-center gap-2 text-sm">
                        <span className="text-muted">Area</span>
                        <Select aria-label="Area" value={area ?? ''} className="w-auto" onChange={event => setParams(event.target.value ? { group: event.target.value } : {}, { replace: true })}>
                            <option value="">All areas</option>
                            {[ ...all.keys() ].map(name => <option key={name} value={name}>{`${name} (${all.get(name)!.length})`}</option>)}
                        </Select>
                    </label>
                )}
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
                {shownWindow && (
                    <Panel
                        title="Preview"
                        description="The window as the game draws it with the values typed below, before they are saved."
                        actions={windows.length > 1 && (
                            <select aria-label="Window to preview" value={shownWindow} onChange={event => setPreviewed(event.target.value)} className="rounded-lg border border-line bg-surface px-2 py-1.5 font-mono text-xs">
                                {windows.map(id => <option key={id} value={id}>{id}</option>)}
                            </select>
                        )}
                    >
                        <div className="p-4"><DesignPreview template={shownWindow} draft={draft} owner={key} /></div>
                    </Panel>
                )}
                {groups.map(([ name, inGroup ]) => (
                    <Panel key={name} title={name} description={GROUP_HINTS[name]}>
                        <ul className="divide-y divide-line">
                            {inGroup.map(style => <StyleRow key={`${style.name}-${style.value}`} pluginKey={key} style={style} canManage={data!.canManage} fonts={fonts} onDraft={onDraft} />)}
                        </ul>
                    </Panel>
                ))}
                <p className="text-xs text-muted">
                    {'An image property picks from the images uploaded under '}
                    <Link to={`/appearance/images/${encodeURIComponent(key)}`} className="text-accent hover:underline">Images</Link>
                    .
                </p>
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
