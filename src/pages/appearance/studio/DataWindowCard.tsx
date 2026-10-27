import { Copy, Trash2 } from 'lucide-react';

import type { DataWindowButton, DataWindowEntry, DataWindowFile } from '#/api/dataWindows';
import { ImageInput } from '#/components/ImageInput';
import { Button, Checkbox, Input, Labeled, Select } from '#/components/ui';

import { clickableElements, containerNames } from './dataWindows';

/** A button's action as the form picks it: `window:<name>` opens another of the theme's windows. */
const actionOf = (button: DataWindowButton | undefined, theme: string) => {
    if (!button) return '';
    if ('close' in button) return 'close';
    if ('show' in button) return `show:${button.show}`;

    const own = new RegExp(`^(?:event:)?window/${theme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/([a-z0-9_-]+)$`).exec(button.link);

    return own ? `window:${own[1]}` : 'link';
};

/**
 * What a theme's own window does beyond how it looks: its title, where players open it from (the me
 * menu, a toolbar icon), what each of its buttons does (close it, open another of the theme's windows,
 * open an in-client link). Every change is part of the studio's draft, drawn at once and saved with it.
 */
export const DataWindowCard = ({ theme, name, file, others, canManage, onChange, onDuplicate, onDelete }: {
    theme: string;
    name: string;
    file: DataWindowFile;
    /** The theme's other windows, by name and title: what a button may open. */
    others: { name: string; title: string }[];
    canManage: boolean;
    onChange: (file: DataWindowFile, group?: string) => void;
    onDuplicate: () => void;
    onDelete: () => void;
}) => {
    const entries = file.entries ?? [];
    // The pages a button may show: the containers the window has by name.
    const pages = containerNames(file.template);
    const meMenu = entries.find(entry => entry.where === 'memenu');
    const toolbar = entries.find(entry => entry.where === 'toolbar');
    const setEntry = (where: DataWindowEntry['where'], entry: DataWindowEntry | null, group?: string) => onChange({ ...file, entries: [ ...entries.filter(each => each.where !== where), ...(entry ? [ entry ] : []) ] }, group);
    const setButton = (element: string, button: DataWindowButton | null) => {
        const buttons = { ...file.buttons };

        if (button) buttons[element] = button;
        else delete buttons[element];

        onChange({ ...file, buttons });
    };

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-canvas p-3" data-testid="data-window-card" data-window={name}>
            <div className="flex flex-wrap items-end gap-3">
                <Labeled label="Title" className="min-w-48 flex-1">
                    <Input value={file.title} disabled={!canManage} onChange={event => onChange({ ...file, title: event.target.value }, `${name}:title`)} />
                </Labeled>
                <Button variant="ghost" icon={<Copy />} disabled={!canManage} onClick={onDuplicate}>Duplicate</Button>
                <Button variant="ghost" icon={<Trash2 />} disabled={!canManage} onClick={onDelete}>Delete</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Checkbox label="In the me menu" checked={!!meMenu} disabled={!canManage} onChange={on => setEntry('memenu', on ? { where: 'memenu', caption: file.title } : null)} />
                    {meMenu?.where === 'memenu' && <Input aria-label="Me menu caption" value={meMenu.caption} disabled={!canManage} onChange={event => setEntry('memenu', { where: 'memenu', caption: event.target.value }, `${name}:memenu`)} />}
                </div>
                <div className="flex flex-col gap-1.5">
                    <Checkbox label="A toolbar icon" checked={!!toolbar} disabled={!canManage} onChange={on => setEntry('toolbar', on ? { where: 'toolbar', icon: '', tooltip: file.title } : null)} />
                    {toolbar?.where === 'toolbar' && <ImageInput value={toolbar.icon} disabled={!canManage} onChange={icon => setEntry('toolbar', { ...toolbar, icon })} accept={{ shapes: [ 'plugin', 'libraryUrl', 'url' ], plugin: theme, usedIn: 'theme.window' }} title="Pick the toolbar icon" />}
                </div>
            </div>
            {clickableElements(file.template).map((element) => {
                const button = file.buttons?.[element.name!];
                const action = actionOf(button, theme);

                return (
                    <div key={element.name} className="flex flex-wrap items-end gap-2">
                        <Labeled label={`"${element.caption || element.name}" button`} className="min-w-48">
                            <Select
                                value={action}
                                disabled={!canManage}
                                onChange={(event) => {
                                    const value = event.target.value;

                                    setButton(element.name!, value === 'close' ? { close: true } : value.startsWith('show:') ? { show: value.slice(5) } : value.startsWith('window:') ? { link: `window/${theme}/${value.slice(7)}` } : value === 'link' ? { link: 'habbopages/' } : null);
                                }}
                            >
                                <option value="">Does nothing</option>
                                <option value="close">Closes the window</option>
                                {pages.map(page => <option key={page} value={`show:${page}`}>{`Shows ${page.replace(/[_-]+/g, ' ')}`}</option>)}
                                {others.map(other => <option key={other.name} value={`window:${other.name}`}>{`Opens "${other.title}"`}</option>)}
                                <option value="link">Opens a link</option>
                            </Select>
                        </Labeled>
                        {action === 'link' && button && 'link' in button && (
                            <Labeled label="Link" className="min-w-48 flex-1" hint="As a habbo page names one: navigator/goto/<room id>, habbopages/<page>, catalog/open/<page>">
                                <Input value={button.link} disabled={!canManage} onChange={event => setButton(element.name!, { link: event.target.value })} />
                            </Labeled>
                        )}
                    </div>
                );
            })}
            <p className="text-xs text-muted">{`Its link, for a notice, a catalogue page or a habbo page: window/${theme}/${name}`}</p>
        </div>
    );
};
