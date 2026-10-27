import { ChevronRight, Eye, EyeOff, X } from 'lucide-react';
import { useMemo } from 'react';

import { useTextSearch } from '#/api/gamedata';
import { useTemplateIndex, windowOf } from '#/api/windows';
import { IconButton, Input, Labeled, Select, Switch } from '#/components/ui';
import { colourValue, setOf, withSet } from '#/preview/patchOps';
import { ColourField, keyedElements, NumberField, StylePicker } from '#/preview/VisualEditor';

import { useStudio } from './studio';
import { studioWindows } from './windows';

/** A text an element shows, edited in place: the hotel's text by its key, unsaved until the studio's Save. */
const TextField = ({ textKey }: { textKey: string }) => {
    const studio = useStudio();
    const { data } = useTextSearch(textKey, 0);
    const saved = data?.items.find(item => item.key === textKey)?.value;
    const draft = studio.text(textKey);

    return (
        <Labeled label="Text" hint={`What players read here, in every window showing it (${textKey}).`}>
            <Input
                aria-label={`Text ${textKey}`}
                value={draft ?? saved ?? ''}
                disabled={!studio.canManage}
                onChange={event => studio.setText(textKey, event.target.value === saved ? undefined : event.target.value, `text:${textKey}`)}
            />
        </Labeled>
    );
};

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

/**
 * The picked element, edited in place: where it is (window > part > element), its place and size,
 * shown or hidden, colour, skin and texts - each change unsaved until the studio's Save, and drawn in
 * the preview at once. With nothing picked, the window itself (its colour).
 */
export const Inspector = () => {
    const studio = useStudio();
    const { data: index } = useTemplateIndex();
    const windows = useMemo(() => (index ? studioWindows(index) : []), [ index ]);
    const selection = studio.selection;
    const shownWindow = windows.find(window => window.id === studio.window);
    const template = selection?.template ?? studio.window;
    const found = index && template ? windowOf(index, template) : undefined;
    const key = selection ? selection.key : '';
    const indexed = useMemo(() => (key === null ? undefined : keyedElements(found?.elements ?? []).find(entry => entry.element.key === key)?.element), [ found, key ]);

    if (!studio.window || !template) return <p className="p-4 text-sm text-muted">Pick a window on the left, then click anything in it.</p>;

    const ops = studio.ops(template);
    const values = key === null ? {} : setOf(ops, key);
    const set = (property: string, value: unknown, group = property) => {
        if (key !== null) studio.changeOps(template, withSet(ops, key, property, value), `${template}:${key}:${group}`);
    };
    const part = selection && selection.template !== selection.window ? selection.template : null;
    const drawn = selection?.element;
    const own = indexed ? { x: indexed.rect[0], y: indexed.rect[1], width: indexed.rect[2], height: indexed.rect[3] } : drawn;
    const hidden = typeof values.hidden === 'boolean' ? values.hidden : !!indexed?.hidden;
    const style = typeof values.style === 'string' ? values.style : (typeof values.style === 'number' ? String(values.style) : indexed?.style);
    const tag = selection?.tag ?? found?.elements[0]?.tag ?? 'frame';
    const texts = indexed?.texts ?? [];
    const sharedBy = part ? windows.filter(window => window.parts.includes(part)).length : 0;

    return (
        <div className="flex flex-col gap-3 p-3 text-sm" aria-label="Inspector">
            <nav aria-label="Where it is" className="flex flex-wrap items-center gap-1 text-xs">
                <span className="font-medium">{shownWindow?.name ?? studio.window}</span>
                {part && (
                    <>
                        <ChevronRight className="size-3 text-muted" />
                        <span title={part}>{part.split('/').pop()}</span>
                    </>
                )}
                {selection && (
                    <>
                        <ChevronRight className="size-3 text-muted" />
                        <span className="font-mono">{key === null ? selection.tag : (key === '' ? 'the window' : (indexed?.name ?? key))}</span>
                        <IconButton label="Pick nothing" icon={<X />} small onClick={() => studio.select(null)} />
                    </>
                )}
            </nav>
            <ElementPicker />
            {sharedBy > 1 && <p className="text-xs text-warn">{`Drawn in ${sharedBy} windows: a change here shows in each.`}</p>}
            {key === null && <p className="text-xs text-muted">{`A ${selection?.tag ?? 'part'} the window's code made: no patch reaches it. Pick what is around it.`}</p>}
            {key !== null && (
                <>
                    <ColourField label={key === '' && found?.elements[0]?.tag === 'frame' ? 'Window colour' : 'Colour'} value={colourValue(values.color ?? null)} own={colourValue(drawn?.color ?? null)} onChange={argb => set('color', argb)} onReset={() => set('color', undefined, 'color-reset')} />
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
                                onChange={on => set('hidden', on === !!indexed?.hidden ? undefined : on)}
                            />
                        </>
                    )}
                    <Labeled label="Skin">
                        <StylePicker tag={tag} value={style} onChange={next => set('style', next === indexed?.style ? undefined : next)} />
                    </Labeled>
                    {texts.map(text => <TextField key={text} textKey={text} />)}
                </>
            )}
        </div>
    );
};
