import { Plus, Save } from 'lucide-react';
import { useState } from 'react';

import { COLOR_SLOTS, type GroupBadgePart, type GroupColor, PART_TYPES, useCanManageContent, useGroupEditor, useSaveGroupEditor } from '#/api/content';
import { Button, ErrorNotice, IconButton, Input, Loading, PageBody, PageHeader, Panel, Select } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';

/** A part's files, edited where it is listed. */
const PartRow = ({ part, canManage }: { part: GroupBadgePart; canManage: boolean }) => {
    const [ file, setFile ] = useState(part.fileName);
    const [ mask, setMask ] = useState(part.maskFileName);
    const save = useSaveGroupEditor();
    const changed = file !== part.fileName || mask !== part.maskFileName;

    return (
        <li className="flex flex-wrap items-center gap-2 px-3 py-1.5">
            <span className="w-10 text-right font-mono text-xs text-muted">{part.partId}</span>
            <Input value={file} onChange={event => setFile(event.target.value)} aria-label="File" className="h-10 min-w-0 flex-1 font-mono text-xs sm:h-8 sm:w-44 sm:flex-none" disabled={!canManage} />
            <Input value={mask} onChange={event => setMask(event.target.value)} aria-label="Mask" placeholder="no mask" className="h-10 min-w-0 flex-1 font-mono text-xs sm:h-8 sm:w-44 sm:flex-none" disabled={!canManage} />
            {canManage && changed && <IconButton label="Save" icon={<Save />} disabled={save.isPending} onClick={() => save.mutate({ kind: 'parts', id: part.id, body: { fileName: file, maskFileName: mask } })} />}
            {save.error && <ErrorNotice error={save.error} />}
        </li>
    );
};

/** A colour's hex, edited where it is listed. */
const ColorRow = ({ color, canManage }: { color: GroupColor; canManage: boolean }) => {
    const [ hex, setHex ] = useState(color.color);
    const save = useSaveGroupEditor();

    return (
        <li className="flex items-center gap-2 px-3 py-1.5">
            <span className="w-8 text-right font-mono text-xs text-muted">{color.colorId}</span>
            <input
                type="color"
                value={`#${/^[0-9a-f]{6}$/i.test(hex) ? hex : '000000'}`}
                onChange={event => setHex(event.target.value.slice(1))}
                disabled={!canManage}
                aria-label={`Colour ${color.colorId}`}
                className="h-8 w-10 cursor-pointer rounded border border-line bg-canvas p-0.5"
            />
            <Input value={hex} onChange={event => setHex(event.target.value.replace('#', ''))} className="h-8 w-24 font-mono text-xs sm:h-8" disabled={!canManage} />
            {canManage && hex !== color.color && <IconButton label="Save" icon={<Save />} disabled={save.isPending} onClick={() => save.mutate({ kind: 'colors', id: color.id, body: { color: hex } })} />}
            {save.error && <ErrorNotice error={save.error} />}
        </li>
    );
};

/**
 * The parts and colours players build group badges from. Their ids are written into every badge
 * code, so they are only added: a file or a colour may change, its id never does.
 */
const BadgeEditor = ({ canManage }: { canManage: boolean }) => {
    const { data, error } = useGroupEditor();
    const save = useSaveGroupEditor();
    const [ partType, setPartType ] = useState('1');
    const [ file, setFile ] = useState('');
    const [ slot, setSlot ] = useState('0');
    const [ hex, setHex ] = useState('');

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    return (
        <div className="grid items-start gap-4 lg:grid-cols-2">
            <Panel title="Badge parts" description="Bases and symbols; the client loads badgepart_<file>.png. Read again by the hotel as soon as one is saved." className="overflow-clip">
                {[ 0, 1 ].map(type => (
                    <section key={type}>
                        <h3 className="border-b border-line bg-subtle px-3 py-1.5 font-mono text-[11px] tracking-wide text-muted uppercase">{PART_TYPES[type]}s</h3>
                        <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                            {data.parts.filter(x => x.partType === type).map(part => <PartRow key={part.id} part={part} canManage={canManage} />)}
                        </ul>
                    </section>
                ))}
                {canManage && (
                    <form
                        className="flex flex-wrap gap-2 border-t border-line p-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            save.mutate({ kind: 'parts', id: null, body: { partType: Number(partType), fileName: file.trim() } }, { onSuccess: () => setFile('') });
                        }}
                    >
                        <Select value={partType} onChange={event => setPartType(event.target.value)} aria-label="Kind" className="w-32">
                            {Object.entries(PART_TYPES).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                        <Input value={file} onChange={event => setFile(event.target.value)} placeholder="file name" className="min-w-0 flex-1 font-mono text-xs" />
                        <Button type="submit" variant="secondary" icon={<Plus />} disabled={!file.trim() || save.isPending}>Add</Button>
                    </form>
                )}
            </Panel>
            <Panel title="Colours" description="The badge's colours, and the group's two. Changing one repaints every badge that uses it." className="overflow-clip">
                {[ 0, 1, 2 ].map(colorSlot => (
                    <section key={colorSlot}>
                        <h3 className="border-b border-line bg-subtle px-3 py-1.5 font-mono text-[11px] tracking-wide text-muted uppercase">{COLOR_SLOTS[colorSlot]}</h3>
                        <ul className="max-h-60 divide-y divide-line overflow-y-auto">
                            {data.colors.filter(x => x.slot === colorSlot).map(color => <ColorRow key={color.id} color={color} canManage={canManage} />)}
                        </ul>
                    </section>
                ))}
                {canManage && (
                    <form
                        className="flex flex-wrap gap-2 border-t border-line p-3"
                        onSubmit={(event) => {
                            event.preventDefault();
                            save.mutate({ kind: 'colors', id: null, body: { slot: Number(slot), color: hex.trim() } }, { onSuccess: () => setHex('') });
                        }}
                    >
                        <Select value={slot} onChange={event => setSlot(event.target.value)} aria-label="Slot" className="w-36">
                            {Object.entries(COLOR_SLOTS).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                        <Input value={hex} onChange={event => setHex(event.target.value)} placeholder="ff8800" className="w-28 font-mono text-xs" />
                        <Button type="submit" variant="secondary" icon={<Plus />} disabled={!hex.trim() || save.isPending}>Add</Button>
                    </form>
                )}
                {save.error && <div className="p-3"><ErrorNotice error={save.error} /></div>}
            </Panel>
        </div>
    );
};

/** The parts and colours group badges are built from, beside the groups that wear them. */
export const BadgePartsPage = () => {
    const canManage = useCanManageContent();
    const tabs = useHubTabs('groups');

    return (
        <>
            <PageHeader title="Badge parts" tabs={tabs} description="The bases, symbols and colours players build group badges from" />
            <PageBody>
                <BadgeEditor canManage={canManage} />
            </PageBody>
        </>
    );
};
