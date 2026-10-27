import { Copy, ImageIcon, Trash2, Upload } from 'lucide-react';
import { useParams } from 'react-router';

import { FONT_TYPES, useFontChange, useImageChange, usePluginFonts, usePluginImages } from '#/api/noCode';
import { useWorkingOn } from '#/appearance/workingOn';
import { WorkingOnPicker } from '#/appearance/WorkingOnPicker';
import { toast, toastError } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, Loading, PageBody, PageHeader, Panel } from '#/components/ui';

import { ThemePicker } from './ThemePicker';

const IMAGE_TYPES = 'image/png,image/gif,image/jpeg,image/webp';

const copy = (text: string) => void navigator.clipboard.writeText(text).then(() => toast(`Copied ${text}`));

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
 * The plugin's fonts (its `wwwroot/styles/`): upload a WOFF2, WOFF, TrueType or OpenType file and
 * clients load it as the family its name says, which a font style property then picks; take one away
 * with its family.
 */
const FontsPanel = ({ pluginKey }: { pluginKey: string }) => {
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

/** A theme's images and fonts (its `wwwroot/styles/`), the hotel's by default: upload, copy the path a patch or style names, remove. */
export const ImagesPage = () => {
    const { key: picked = 'hotel' } = useParams();
    const working = useWorkingOn();
    // Working on a theme, uploads land in its files; on the hotel, any theme's images are shown.
    const key = working.hotel ? picked : working.key;

    return (
        <>
            <PageHeader title="Images" description="The art a theme's patches and image properties name: frame art, icons, backgrounds. Upload here, then pick it in the Theme studio or paste its path into a patch.">
                {working.hotel && <ThemePicker value={key} to={next => `/appearance/images/${encodeURIComponent(next)}`} />}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <WorkingOnPicker className="rounded-xl border border-line bg-surface px-4 py-2.5" />
                <ImagesPanel pluginKey={key} />
                <FontsPanel pluginKey={key} />
            </PageBody>
        </>
    );
};
