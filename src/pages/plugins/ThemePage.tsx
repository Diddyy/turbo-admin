import { ExternalLink, Package, RotateCcw, Save, Upload } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';

import { useClientAssets } from '#/api/assets';
import { type PluginStyle, usePluginStyles, useStyleChange } from '#/api/noCode';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel } from '#/components/ui';

import { PackageDialog } from './PackageDialog';

/** `#rrggbb` (or `#aarrggbb`) as the browser's colour picker takes it: its last six digits. */
const pickerValue = (value: string) => /^#[0-9a-f]{6,8}$/i.test(value) ? `#${value.slice(-6)}` : '#000000';

/** One style: its picker, what the hotel has, and Reset back to the theme's default. */
const StyleRow = ({ pluginKey, style, canManage }: { pluginKey: string; style: PluginStyle; canManage: boolean }) => {
    const [ value, setValue ] = useState(style.value);
    const change = useStyleChange(pluginKey);
    const dirty = value !== style.value;
    const said = { onSuccess: () => toast(`${style.label ?? style.name}: saved.`), onError: toastError };

    return (
        <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-col sm:w-72">
                <span className="flex items-center gap-2 font-medium">
                    {style.label ?? style.name}
                    {style.changed && <Badge tone="amber">changed</Badge>}
                </span>
                <span className="truncate font-mono text-xs text-muted" title={style.hint ?? undefined}>{`\${style:${style.name}}`}{style.overlay ? ` - ${style.overlay}` : ''}</span>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2">
                {style.type === 'color' && (
                    <>
                        <input type="color" aria-label={`${style.name} colour`} value={pickerValue(value)} disabled={!canManage} onChange={event => setValue(event.target.value)} className="h-9 w-12 cursor-pointer rounded border border-line bg-transparent" />
                        <Input aria-label={style.name} value={value} disabled={!canManage} onChange={event => setValue(event.target.value)} className="w-32 font-mono" />
                    </>
                )}
                {style.type === 'number' && <Input type="number" aria-label={style.name} value={value} min={style.min ?? undefined} max={style.max ?? undefined} disabled={!canManage} onChange={event => setValue(event.target.value)} className="w-32" />}
                {(style.type === 'font' || style.type === 'text') && <Input aria-label={style.name} value={value} disabled={!canManage} onChange={event => setValue(event.target.value)} className="w-64" style={style.type === 'font' ? { fontFamily: value } : undefined} />}
                {style.type === 'image' && (
                    <>
                        {/^(\/|https?:)/.test(style.value) && <img src={style.value} alt="" className="max-h-12 max-w-32 rounded border border-line bg-subtle object-contain" />}
                        <span className="max-w-72 truncate font-mono text-xs text-muted" title={style.value}>{style.value}</span>
                        {canManage && (
                            <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-accent hover:underline">
                                <Upload className="size-4" />
                                Upload
                                <input
                                    type="file"
                                    accept="image/png,image/gif,image/jpeg,image/webp"
                                    className="sr-only"
                                    onChange={(event) => {
                                        const file = event.target.files?.[0];

                                        if (file) change.mutate({ name: style.name, file }, said);
                                    }}
                                />
                            </label>
                        )}
                    </>
                )}
                {style.type !== 'image' && canManage && <Button icon={<Save />} disabled={!dirty || change.isPending} onClick={() => change.mutate({ name: style.name, value }, said)}>Save</Button>}
                {style.changed && canManage && (
                    <Button
                        variant="ghost"
                        icon={<RotateCcw />}
                        disabled={change.isPending}
                        title={`The theme's default: ${style.default}`}
                        onClick={() => change.mutate({ name: style.name, value: null }, { onSuccess: (reset) => {
                            setValue(reset.value);
                            toast(`${style.label ?? style.name}: back to the theme's ${style.default}.`);
                        }, onError: toastError })}
                    >
                        Reset
                    </Button>
                )}
                {!style.changed && <span className="text-xs text-muted">the theme's default</span>}
            </div>
        </li>
    );
};

/**
 * A theme's style properties (its `theme.json`) with the hotel's values: staff change a colour,
 * size, image or font once and every patch naming it follows, at each player's next load.
 */
export const ThemePage = () => {
    const { key = '' } = useParams();
    const { data, error } = usePluginStyles(key);
    const assets = useClientAssets();
    const [ packaging, setPackaging ] = useState(false);
    const groups = Map.groupBy(data?.styles ?? [], style => style.group ?? 'Styles');
    const client = assets?.preview ? assets.preview.replace(/[?&]preview\b.*$/, '') : null;

    return (
        <>
            <PageHeader title={`Theme: ${key}`} description="Its style properties, as its theme.json declares them, and this hotel's values. Players see a change at their next load." back={{ to: '/plugins', label: 'Plugins' }}>
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
                {data && data.styles.length === 0 && <EmptyState framed>This plugin declares no style properties: it has no theme.json.</EmptyState>}
                {[ ...groups ].map(([ group, styles ]) => (
                    <Panel key={group} title={group}>
                        <ul className="divide-y divide-line">
                            {styles.map(style => <StyleRow key={`${style.name}-${style.value}`} pluginKey={key} style={style} canManage={data!.canManage} />)}
                        </ul>
                    </Panel>
                ))}
                {data && data.styles.length > 0 && (
                    <Labeled label="In a patch" hint="A value that is a whole style takes its type (a colour stays a number); inside text it is written in.">
                        <code className="rounded bg-subtle px-2 py-1 font-mono text-xs">{`{ "element": "help_button", "set": { "color": "\${style:${data.styles[0]!.name}}" } }`}</code>
                    </Labeled>
                )}
            </PageBody>
            <PackageDialog pluginKey={key} open={packaging} onClose={() => setPackaging(false)} />
        </>
    );
};
