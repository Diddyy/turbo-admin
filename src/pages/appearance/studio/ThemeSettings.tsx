import { RotateCcw } from 'lucide-react';

import type { PluginFont, PluginStyle } from '#/api/noCode';
import { CLIENTS_OWN, GROUP_HINTS, pickerValue, resetTo, SHIPPED_FONTS } from '#/appearance/styleValues';
import { ImageInput } from '#/components/ImageInput';
import { Badge, EmptyState, IconButton, Input, Select } from '#/components/ui';

import { useStudio } from './studio';

/** `x,y` as two numbers, or none. */
const positionOf = (value: string) => {
    const match = /^(-?\d+)\s*,\s*(-?\d+)$/.exec(value.trim());

    return match ? { x: match[1]!, y: match[2]! } : { x: '', y: '' };
};

/** One style property as a control of its kind: a colour swatch, a number, a place, a font, an image or a text. */
const StyleControl = ({ style, fonts, onFocus }: { style: PluginStyle; fonts: readonly PluginFont[]; onFocus: () => void }) => {
    const studio = useStudio();
    const value = studio.style(style.name) ?? '';
    const saved = style.value ?? '';
    const set = (next: string) => studio.setStyle(style.name, next === saved ? undefined : next, `style:${style.name}`);
    const disabled = !studio.canManage;
    const label = style.label ?? style.name;
    const unsaved = studio.style(style.name) !== (style.value ?? null);
    const position = positionOf(value);

    return (
        <li className="flex flex-col gap-1.5 px-3 py-2" onFocusCapture={onFocus}>
            <span className="flex items-center gap-2 text-[13px] font-medium">
                {label}
                {unsaved ? <Badge tone="amber">unsaved</Badge> : style.changed && <Badge>changed</Badge>}
                {(style.changed || unsaved) && studio.canManage && (
                    <IconButton
                        label={`Back to ${resetTo(style)}`}
                        icon={<RotateCcw />}
                        small
                        className="ml-auto"
                        onClick={() => studio.setStyle(style.name, style.changed ? null : undefined, `style:${style.name}`)}
                    />
                )}
            </span>
            {style.hint && <span className="text-xs text-muted">{style.hint}</span>}
            <span className="flex flex-wrap items-center gap-2">
                {style.type === 'color' && (
                    <>
                        <input type="color" aria-label={`${label} colour`} value={pickerValue(value)} disabled={disabled} onChange={event => set(event.target.value)} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" />
                        <Input aria-label={label} value={value} placeholder={CLIENTS_OWN} disabled={disabled} onChange={event => set(event.target.value)} className="w-28 font-mono" />
                    </>
                )}
                {style.type === 'number' && <Input type="number" aria-label={label} value={value} min={style.min ?? undefined} max={style.max ?? undefined} disabled={disabled} onChange={event => set(event.target.value)} className="w-28" />}
                {style.type === 'position' && (
                    <>
                        <Input type="number" aria-label={`${label} x`} value={position.x} placeholder="x" disabled={disabled} onChange={event => set(`${event.target.value},${position.y || 0}`)} className="w-24" />
                        <Input type="number" aria-label={`${label} y`} value={position.y} placeholder="y" disabled={disabled} onChange={event => set(`${position.x || 0},${event.target.value}`)} className="w-24" />
                    </>
                )}
                {style.type === 'font' && (
                    <Select aria-label={label} value={value} disabled={disabled} className="w-auto" style={{ fontFamily: value || undefined }} onChange={event => set(event.target.value)}>
                        <option value="">{CLIENTS_OWN}</option>
                        <optgroup label="The client's">{SHIPPED_FONTS.map(face => <option key={face} value={face}>{face}</option>)}</optgroup>
                        {fonts.length > 0 && <optgroup label="Uploaded">{fonts.map(font => <option key={font.path} value={font.family}>{font.family}</option>)}</optgroup>}
                    </Select>
                )}
                {style.type === 'text' && <Input aria-label={label} value={value} placeholder={CLIENTS_OWN} disabled={disabled} onChange={event => set(event.target.value)} className="w-full" />}
                {style.type === 'image' && (
                    <ImageInput
                        value={value}
                        onChange={next => studio.setStyle(style.name, next === saved ? undefined : (next || null))}
                        accept={{ shapes: [ 'plugin' ], plugin: studio.theme, usedIn: 'theme.style' }}
                        title={label}
                        resolve={path => (/^(\/|https?:)/.test(path) ? path : null)}
                        disabled={disabled}
                        className="w-full"
                    />
                )}
            </span>
        </li>
    );
};

/**
 * The theme's style properties as controls, by area (colours, art, fonts, places, the loading
 * screen): each change unsaved until the studio's Save, drawn in the preview at once, and the window
 * it restyles shown when its control is used.
 */
export const ThemeSettings = ({ fonts, onWindow }: { fonts: readonly PluginFont[]; onWindow: (style: PluginStyle) => void }) => {
    const studio = useStudio();
    const groups = [ ...Map.groupBy(studio.styles, style => style.group ?? 'Styles') ];

    if (!groups.length) return <EmptyState>This theme names no style properties: one that extends Habbo&apos;s own has them.</EmptyState>;

    return (
        <div className="flex flex-col">
            {groups.map(([ name, styles ]) => (
                <section key={name} aria-label={name} className="border-b border-line">
                    <h3 className="sticky top-0 z-10 bg-surface px-3 pt-2 text-xs font-medium text-muted uppercase">{name}</h3>
                    {GROUP_HINTS[name] && <p className="bg-surface px-3 pb-1 text-xs text-muted">{GROUP_HINTS[name]}</p>}
                    <ul className="divide-y divide-line">
                        {styles.map(style => <StyleControl key={style.name} style={style} fonts={fonts} onFocus={() => onWindow(style)} />)}
                    </ul>
                </section>
            ))}
        </div>
    );
};
