import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { ImageAccept } from '#/api/media';
import { Button, IconButton, Input, Labeled, Select, Switch } from '#/components/ui';

import type { HotelViewDraft } from './draft';
import { useResolveImage } from './hooks';
import { ELEMENT_TYPES, formatConf, formatLayout, type GenericElement, type GenericLayout, isTextArg, LIBRARY_ADDRESS, parseConf, parseLayout } from './model';
import { Changed, ImageField, TextKeyField } from './parts';
import { GenericPreview } from './Preview';

const WIDGET_IMAGE: ImageAccept = { ...LIBRARY_ADDRESS, usedIn: 'hotelView.widget' };

const ARG_LABELS: Record<string, string> = {
    text: 'Text',
    width: 'Width (pixels)',
    page: 'Catalogue page',
    link: 'Client link',
    url: 'Address',
    height: 'Height (pixels)',
    floating: 'Floating',
    x: 'X',
    y: 'Y',
    running: 'While counting',
    expired: 'Once over',
    until: 'Counts to (UTC, yyyy-MM-dd HH:mm)',
};

const ARG_HINTS: Record<string, string> = {
    page: 'The page\'s name (its link); empty opens the catalogue where it was left.',
    link: 'A client link, such as habbicons/open or navigator/goto/123.',
    url: 'Players are warned they are leaving the hotel first.',
    width: 'Empty is 250.',
};

/** One element of the column: its type, and each argument by what it is. */
const ElementEditor = ({ element, onChange, draft, suggestKey, disabled }: {
    element: GenericElement;
    onChange: (element: GenericElement) => void;
    draft: HotelViewDraft;
    suggestKey: (type: string) => string;
    disabled?: boolean;
}) => {
    const known = ELEMENT_TYPES.find(x => x.value === element.type);
    const setArg = (index: number, value: string) => {
        const args = [ ...element.args ];

        while (args.length <= index) args.push('');

        args[index] = value.replaceAll(',', '').replaceAll(';', '');
        onChange({ ...element, args });
    };

    if (!known)
        return (
            <Labeled label={`${element.type}: arguments`} hint="An element the panel has no form for: its arguments as the variable writes them, separated by commas.">
                <Input value={element.args.join(',')} onChange={event => onChange({ ...element, args: event.target.value.replaceAll(';', '').split(',') })} className="w-full font-mono text-xs" disabled={disabled} />
            </Labeled>
        );

    return (
        <div className="flex flex-col gap-3">
            {known.args.map((arg, index) => {
                const value = element.args[index] ?? '';

                if (isTextArg(element.type, index))
                    return (
                        <TextKeyField
                            key={arg}
                            label={ARG_LABELS[arg] ?? arg}
                            textKey={value}
                            onKeyChange={key => setArg(index, key)}
                            draft={draft}
                            disabled={disabled}
                        />
                    );

                if (arg === 'floating')
                    return <Switch key={arg} label="Floating" hint="At its own place over the promo, rather than in the column." checked={value === 'true'} onChange={checked => setArg(index, checked ? 'true' : 'false')} disabled={disabled} />;

                return (
                    <Labeled key={arg} label={ARG_LABELS[arg] ?? arg} hint={ARG_HINTS[arg]}>
                        <Input
                            value={value}
                            onChange={event => setArg(index, event.target.value)}
                            inputMode={[ 'width', 'height', 'x', 'y' ].includes(arg) ? 'numeric' : undefined}
                            placeholder={arg === 'until' ? '2026-12-31 18:00' : undefined}
                            className="w-full font-mono text-xs"
                            disabled={disabled}
                        />
                    </Labeled>
                );
            })}
            {element.args.length === 0 && isTextArg(element.type, 0) && !disabled && (
                <div>
                    <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setArg(0, suggestKey(element.type))}>Use {suggestKey(element.type)}</Button>
                </div>
            )}
        </div>
    );
};

/**
 * A generic promo (`GenericWidget`): a picture placed by its layout, and a column of elements -
 * headings, text, buttons, links, countdowns - whose words are external texts. Beside it, the promo
 * as the client draws it.
 */
export const GenericEditor = ({ confKey, layoutKey, draft, wide: initialWide, textPrefix, disabled }: {
    confKey: string;
    layoutKey: string;
    draft: HotelViewDraft;
    /** Whether it is in a wide slot (1, 2, 4) first; the preview can switch. */
    wide: boolean;
    /** What new texts' keys start with: `landing.view.<code>.` */
    textPrefix: string;
    disabled?: boolean;
}) => {
    const resolve = useResolveImage(draft);
    const [ wide, setWide ] = useState(initialWide);
    const [ adding, setAdding ] = useState('caption');
    const elements = parseConf(draft.text(confKey));
    const layout = parseLayout(draft.text(layoutKey));
    const setElements = (next: GenericElement[]) => draft.setText(confKey, formatConf(next));
    const move = (from: number, to: number) => {
        const next = [ ...elements ];
        const [ moved ] = next.splice(from, 1);

        if (moved) next.splice(to, 0, moved);

        setElements(next);
    };
    const setLayout = (field: keyof GenericLayout, value: string) => draft.setText(layoutKey, formatLayout({ ...layout, [field]: value }));
    const suggestKey = (type: string) => {
        const name = type === 'caption' ? 'header' : type === 'bodytext' ? 'body' : type.endsWith('button') || type === 'link' ? 'button' : type;
        let key = `${textPrefix}${name}`;

        for (let n = 2; elements.some(x => x.args[0] === key); n++) key = `${textPrefix}${name}${n}`;

        return key;
    };
    const number = (field: keyof GenericLayout, label: string, placeholder: string) => (
        <Labeled label={label}>
            <Input value={layout[field]} onChange={event => setLayout(field, event.target.value.replace(/[^-\d]/g, ''))} placeholder={placeholder} inputMode="numeric" className="w-full" disabled={disabled} />
        </Labeled>
    );

    // Side by side only where the editor itself has the room: a slot's is the page's width, a promo's beside the list of promos.
    return (
        <div className="@container">
            <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 flex-col gap-5">
                    <section className="flex flex-col gap-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">Picture and placement <Changed on={draft.changed(layoutKey)} /></h3>
                        <ImageField label="Picture" hint="Usually under the client's image library: ${image.library.url}web_promo_small/name.png." value={layout['bitmap.uri']} onChange={value => setLayout('bitmap.uri', value)} accept={WIDGET_IMAGE} resolve={resolve} disabled={disabled} />
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {number('bitmap.x', 'Picture x', '10')}
                            {number('bitmap.y', 'Picture y', '10')}
                            {number('bitmap.width', 'Picture width', 'its own')}
                            {number('bitmap.height', 'Picture height', 'its own')}
                            {number('content.x', 'Column x', wide ? '230' : '0')}
                            {number('content.y', 'Column y', '0')}
                            {number('content.width', 'Column width', '250')}
                            {number('container.height', 'Least height', '30')}
                        </div>
                    </section>
                    <section className="flex flex-col gap-3">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">Column <Changed on={draft.changed(confKey)} /></h3>
                        {elements.length === 0 && <p className="text-sm text-muted">Nothing in the column yet.</p>}
                        <ol className="flex flex-col gap-3">
                            {elements.map((element, index) => (
                                <li key={index} className="flex flex-col gap-3 rounded-lg border border-line p-3">
                                    <div className="flex items-center gap-2">
                                        <span className="w-5 text-right font-mono text-xs text-muted">{index + 1}</span>
                                        <Select
                                            value={element.type}
                                            onChange={event => setElements(elements.map((x, i) => (i === index ? { type: event.target.value, args: event.target.value === 'customtimer' ? [ 'false', '0', '0' ] : [] } : x)))}
                                            className="min-w-0 flex-1 sm:max-w-64"
                                            disabled={disabled}
                                            aria-label="Element"
                                        >
                                            {ELEMENT_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                                            {!ELEMENT_TYPES.some(x => x.value === element.type) && <option value={element.type}>{element.type}</option>}
                                        </Select>
                                        {!disabled && (
                                            <span className="ml-auto flex">
                                                <IconButton label="Up" icon={<ArrowUp />} disabled={index === 0} onClick={() => move(index, index - 1)} />
                                                <IconButton label="Down" icon={<ArrowDown />} disabled={index === elements.length - 1} onClick={() => move(index, index + 1)} />
                                                <IconButton label="Remove" icon={<Trash2 />} tone="bad" onClick={() => setElements(elements.filter((_, i) => i !== index))} />
                                            </span>
                                        )}
                                    </div>
                                    <ElementEditor element={element} onChange={next => setElements(elements.map((x, i) => (i === index ? next : x)))} draft={draft} suggestKey={suggestKey} disabled={disabled} />
                                </li>
                            ))}
                        </ol>
                        {!disabled && (
                            <div className="flex flex-wrap items-center gap-2">
                                <Select value={adding} onChange={event => setAdding(event.target.value)} aria-label="Element to add" className="sm:max-w-64">
                                    {ELEMENT_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                                </Select>
                                <Button
                                    variant="secondary"
                                    icon={<Plus />}
                                    onClick={() => setElements([ ...elements, { type: adding, args: adding === 'customtimer' ? [ 'false', '0', '0', suggestKey('timer'), suggestKey('timer.expired') ] : adding === 'spacing' ? [ '10' ] : [ suggestKey(adding) ] } ])}
                                >
                                    Add
                                </Button>
                            </div>
                        )}
                    </section>
                </div>
                <aside className="flex min-w-0 flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-medium text-muted">As the client draws it</span>
                        <Select value={wide ? 'wide' : 'narrow'} onChange={event => setWide(event.target.value === 'wide')} aria-label="Slot width" className="h-8 text-xs sm:h-8">
                            <option value="wide">In a wide slot (1, 2, 4)</option>
                            <option value="narrow">In a narrow slot (3, 5)</option>
                        </Select>
                    </div>
                    <div className="max-w-full overflow-auto rounded-lg border border-line bg-[#aae0f0] p-3">
                        <GenericPreview conf={draft.text(confKey)} layout={draft.text(layoutKey)} wide={wide} draft={draft} />
                    </div>
                </aside>
            </div>
        </div>
    );
};
