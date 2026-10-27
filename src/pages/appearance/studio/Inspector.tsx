import { ChevronRight, Eye, EyeOff, Type, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { type PluginStyle, usePluginFonts } from '#/api/noCode';
import { useTemplateIndex, windowOf } from '#/api/windows';
import { ImageInput } from '#/components/ImageInput';
import { IconButton, Labeled, Select, Switch } from '#/components/ui';
import { ALIGN_H, ALIGN_V, colourValue, SCALES, setOf, withEntry, withSet } from '#/preview/patchOps';
import { ColourField, keyedElements, NumberField, PairParam, StylePicker, VarField } from '#/preview/VisualEditor';
import { FLASH_FONT_FACES } from '#/vendor/flash-text/flashFontFaces';

import { ancestorsOf, bindOf, elementOf, isPicture, isText, partName, textKeysOf, withBind } from './inspector/model';
import { SkinCard } from './inspector/SkinCard';
import { TextFields } from './inspector/TextFields';
import { type StudioSelection, useStudio } from './studio';
import { studioWindows, windowsOfPart } from './windows';

/**
 * Every element a patch reaches in the window and in the parts drawn inside it, to pick one the
 * window hides or one too small to click.
 */
const ElementPicker = () => {
    const studio = useStudio();
    const { data: index } = useTemplateIndex();
    const windows = useMemo(() => (index ? studioWindows(index) : []), [ index ]);
    const window = studio.window;

    if (!index || !window) return null;

    const templates = [ window, ...(windows.find(each => each.id === window)?.parts ?? []) ];
    // An option is a template and an element key, by a bar (neither holds one).
    const value = studio.selection?.key === undefined || studio.selection.key === null ? '' : `${studio.selection.template}|${studio.selection.key}`;

    return (
        <Labeled label="Element" hint="Click it in the window, or pick it here (hidden ones too). Esc picks nothing.">
            <Select
                aria-label="Element"
                value={value}
                onChange={(event) => {
                    const [ template, key ] = event.target.value.split('|');
                    const element = keyedElements(windowOf(index, template!)?.elements ?? []).find(entry => entry.element.key === key)?.element;

                    if (template && element) studio.select({ window, template, key: key!, tag: element.tag, name: element.name ?? null });
                }}
            >
                <option value="" disabled>Pick an element</option>
                {templates.map(template => (
                    <optgroup key={template} label={template === window ? 'The window' : `Drawn inside: ${template.split('/').pop()}`}>
                        {keyedElements(windowOf(index, template)?.elements ?? []).map(({ element, depth }) => (
                            <option key={element.key} value={`${template}|${element.key}`}>
                                {`${'  '.repeat(depth)}${element.key === '' ? 'the window' : element.key} (${element.tag}${element.hidden ? ', hidden' : ''})`}
                            </option>
                        ))}
                    </optgroup>
                ))}
            </Select>
        </Labeled>
    );
};

/** The way down to the element: the press's own, else its keyed ancestors in the template drawing it. */
const pathOf = (selection: StudioSelection, index: ReturnType<typeof useTemplateIndex>['data']) => {
    if (selection.path?.length) return selection.path;

    const { template, key } = selection;
    const found = index ? windowOf(index, template) : undefined;

    if (!found || (key === null)) return [ { template, key, tag: selection.tag, name: selection.name } ];

    return ancestorsOf(found.elements, key).map(element => ({ template, key: element.key ?? null, tag: element.tag, name: element.name ?? null }));
};

/** The face a text is drawn in: the client's own, or a font uploaded into the theme; with `style`, of every text in that style property's text style. */
const FontField = ({ theme, style, value, disabled, onChange }: { theme: string; style?: PluginStyle; value: string | undefined; disabled: boolean; onChange: (face: string | undefined) => void }) => {
    const { data } = usePluginFonts(theme);
    const client = [ ...new Set(FLASH_FONT_FACES.map(face => face.family)) ];
    const uploaded = (data?.fonts ?? []).map(font => font.family).filter(family => !client.includes(family));

    return (
        <Labeled label="Font" hint={style ? `${style.label ?? style.name}: every text drawn in this style, in each window.` : 'This text only. Upload a font on Images > Fonts to pick it here.'}>
            <span className="flex items-center gap-2">
                <Type className="size-4 text-muted" />
                <Select aria-label="Font" value={value ?? ''} disabled={disabled} onChange={event => onChange(event.target.value || undefined)} className="flex-1">
                    <option value="">Its own</option>
                    <optgroup label="The client's">
                        {client.map(family => <option key={family} value={family}>{family}</option>)}
                    </optgroup>
                    {uploaded.length > 0 && (
                        <optgroup label="This theme's">
                            {uploaded.map(family => <option key={family} value={family}>{family}</option>)}
                        </optgroup>
                    )}
                </Select>
            </span>
        </Labeled>
    );
};

/**
 * The picked element, edited where it is drawn: the way down to it (window > part > element, a part
 * named as players know it and how many windows share it; a step pressed edits that one), its place
 * and size, shown or hidden, colour, skin - each sprite of it with its art replaced in the theme -
 * the texts it shows, its picture and its font, its variables and layout. Each change is unsaved
 * until the studio's Save, and drawn in the preview at once. With nothing picked, the window itself.
 */
export const Inspector = () => {
    const studio = useStudio();
    const { data: index } = useTemplateIndex();
    const windows = useMemo(() => (index ? studioWindows(index) : []), [ index ]);
    const selection = studio.selection;
    const path = useMemo(() => (selection ? pathOf(selection, index) : []), [ selection, index ]);
    // A step of the way pressed edits that element, until something else is picked.
    const [ pressed, setPressed ] = useState<{ of: StudioSelection | null; at: number } | null>(null);
    const focus = (pressed && (pressed.of === selection)) ? pressed.at : null;

    if (!studio.window) return <p className="p-4 text-sm text-muted">Pick a window on the left, then click anything in it.</p>;

    const nameOf = (template: string) => windows.find(window => window.id === template)?.name ?? index?.parts?.[template]?.name ?? partName(template);
    const step = (focus !== null) ? path[focus] : undefined;
    const picked = !step || (focus === path.length - 1);
    // A patch names the element in the template drawing it: a part's own, for an element of a part.
    const template = step?.template ?? selection?.template ?? studio.window;
    const key = step ? step.key : (selection ? selection.key : '');
    const tag = step?.tag ?? selection?.tag ?? windowOf(index ?? { version: 1, templates: {}, frames: {} }, template)?.elements[0]?.tag ?? 'frame';
    const part = template !== studio.window ? template : null;
    const sharedBy = part ? windowsOfPart(windows, part).length : 0;
    const indexed = key === null ? undefined : elementOf(index, template, key);
    const ops = studio.ops(template);
    const values = key === null ? {} : setOf(ops, key);
    const drawn = picked ? selection?.element : undefined;
    const caption = picked ? selection?.caption : undefined;
    const disabled = !studio.canManage;

    const setOps = (next: unknown[], what: string) => studio.changeOps(template, next, `${template}:${key}:${what}`);
    const set = (property: string, value: unknown, group = property) => {
        if (key !== null) setOps(withSet(ops, key, property, value), group);
    };

    const own = indexed ? { x: indexed.rect[0], y: indexed.rect[1], width: indexed.rect[2], height: indexed.rect[3] } : drawn;
    const ownHidden = !!indexed?.hidden;
    const hidden = typeof values.hidden === 'boolean' ? values.hidden : ownHidden;
    const ownStyle = indexed?.style ?? (picked ? selection?.style ?? undefined : undefined);
    const style = typeof values.style === 'string' ? values.style : (typeof values.style === 'number' ? String(values.style) : ownStyle);
    const setVars = (values.vars ?? {}) as Record<string, unknown>;
    const setParams = (values.params ?? {}) as Record<string, unknown>;
    const drawnVars = drawn?.vars ?? {};
    const shownVars = Object.keys({ ...drawnVars, ...setVars }).filter(name => name !== 'font_face').sort();
    const textKeys = textKeysOf(caption, indexed);
    const picture = key === null ? undefined : bindOf(ops, key).asset;
    // A text style a theme property names (a frame's title, the regular text): its font is the theme's, for every text in it.
    const textStyle = String(setVars.text_style ?? drawnVars.text_style ?? ((tag === 'frame') && (key === '') ? 'u_frame_title' : ''));
    const styleFont = studio.styles.find(entry => (entry.type === 'font') && (entry.variable[0] === 'text.styles.overrides') && (entry.variable[1] === textStyle));

    return (
        <div className="flex flex-col gap-3 p-3 text-sm" aria-label="Inspector">
            <nav aria-label="Where it is" className="flex flex-wrap items-center gap-0.5 text-xs">
                <span className="font-medium">{nameOf(studio.window)}</span>
                {path.map((each, at) => {
                    const startsPart = (each.template !== studio.window) && ((at === 0) || (path[at - 1]!.template !== each.template));
                    const current = (focus ?? path.length - 1) === at;

                    return (
                        <span key={`${each.template}|${each.key ?? at}`} className="flex items-center gap-0.5">
                            <ChevronRight className="size-3 text-muted" />
                            {startsPart && <span className="rounded bg-subtle px-1 text-muted" title={each.template}>{nameOf(each.template)}</span>}
                            <button
                                type="button"
                                onClick={() => setPressed({ of: selection, at })}
                                aria-current={current ? 'true' : undefined}
                                className={`rounded px-1 font-mono hover:bg-subtle ${current ? 'bg-accent-soft font-medium text-accent' : ''}`}
                            >
                                {each.key === '' ? (startsPart ? 'all of it' : 'the window') : (each.name ?? each.key ?? each.tag)}
                            </button>
                        </span>
                    );
                })}
                {selection && <IconButton label="Pick nothing" icon={<X />} small onClick={() => studio.select(null)} />}
            </nav>
            <ElementPicker />
            {part && (
                <p className="rounded-lg border border-line bg-subtle/50 p-2 text-xs">
                    {`${nameOf(part)} is drawn inside ${nameOf(studio.window)}`}
                    {sharedBy > 1 && <span className="ml-1 rounded bg-warn-soft px-1 font-medium text-warn">{`shared by ${sharedBy} windows`}</span>}
                    <span className="block text-muted">{sharedBy > 1 ? 'A change here shows in each of them: a theme patches a part everywhere it is drawn, not one window\'s copy of it.' : 'A theme patches a part everywhere it is drawn.'}</span>
                </p>
            )}
            {key === null && <p className="text-xs text-muted">{`A ${tag} the window's code made: no patch reaches it. Pick what is around it.`}</p>}
            {key !== null && (
                <>
                    <ColourField label={key === '' && tag === 'frame' ? 'Window colour' : 'Colour'} value={colourValue(values.color ?? null)} own={colourValue(drawn?.color ?? null)} onChange={argb => set('color', argb)} onReset={() => set('color', undefined, 'color-reset')} />
                    {key !== '' && (
                        <>
                            <div className="grid grid-cols-2 gap-2">
                                <NumberField label="X" value={values.x} own={own?.x} onChange={value => set('x', value)} />
                                <NumberField label="Y" value={values.y} own={own?.y} onChange={value => set('y', value)} />
                                <NumberField label="Width" value={values.width} own={own?.width} onChange={value => set('width', value)} />
                                <NumberField label="Height" value={values.height} own={own?.height} onChange={value => set('height', value)} />
                            </div>
                            <Switch
                                label={<span className="inline-flex items-center gap-1.5">{hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}Hidden</span>}
                                checked={hidden}
                                onChange={on => set('hidden', on === ownHidden ? undefined : on)}
                            />
                        </>
                    )}
                    <Labeled label="Skin">
                        <StylePicker tag={tag} value={style} onChange={next => set('style', next === ownStyle ? undefined : next)} />
                    </Labeled>
                    <SkinCard tag={tag} style={style} />
                    <TextFields
                        keys={textKeys}
                        shown={(picked ? selection?.texts : undefined) ?? {}}
                        caption={typeof values.caption === 'string' ? values.caption : undefined}
                        ownCaption={caption ?? indexed?.caption}
                        onCaption={value => set('caption', value)}
                    />
                    {isPicture(tag) && (
                        <Labeled label="Picture" hint="An image of the theme's, or one uploaded into it here: drawn in the preview at once.">
                            <ImageInput
                                value={typeof picture === 'string' ? picture : ''}
                                disabled={disabled}
                                onChange={next => setOps(withBind(ops, key, 'asset', next || undefined), 'asset')}
                                accept={{ shapes: [ 'plugin' ], plugin: studio.theme, usedIn: 'theme.patch' }}
                                title={`The picture of ${key || 'the window'}`}
                            />
                        </Labeled>
                    )}
                    {isText(tag, caption ?? indexed?.caption) && (styleFont
                        ? <FontField theme={studio.theme} style={styleFont} disabled={disabled} value={studio.style(styleFont.name) ?? undefined} onChange={next => studio.setStyle(styleFont.name, next ?? null, `style:${styleFont.name}`)} />
                        : <FontField theme={studio.theme} disabled={disabled} value={typeof setVars.font_face === 'string' ? setVars.font_face : undefined} onChange={next => setOps(withEntry(ops, key, 'vars', 'font_face', next), 'font')} />)}
                    {shownVars.length > 0 && (
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-1 text-xs font-medium text-muted">Variables</legend>
                            {shownVars.map(name => <VarField key={name} name={name} value={setVars[name]} own={drawnVars[name]} onChange={value => setOps(withEntry(ops, key, 'vars', name, value), `vars.${name}`)} />)}
                        </fieldset>
                    )}
                    {drawn && (
                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-1 text-xs font-medium text-muted">Layout</legend>
                            <PairParam label="Follows its parent's resize" value={setParams.scale} own={drawn.params.scale} options={[ SCALES, SCALES ]} onChange={pair => setOps(withEntry(ops, key, 'params', 'scale', pair), 'params.scale')} />
                            <PairParam label="Keeps this edge when resized" value={setParams.align} own={drawn.params.align} options={[ ALIGN_H, ALIGN_V ]} onChange={pair => setOps(withEntry(ops, key, 'params', 'align', pair), 'params.align')} />
                        </fieldset>
                    )}
                </>
            )}
        </div>
    );
};
