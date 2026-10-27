import { Plus } from 'lucide-react';
import { useState } from 'react';

import type { DataWindowFile, DataWindowTemplate } from '#/api/dataWindows';
import { ImageInput } from '#/components/ImageInput';
import { Modal } from '#/components/Modal';
import { toastError } from '#/components/toast';
import { Button, Checkbox, Input, Labeled, Segmented, Select, Textarea } from '#/components/ui';

import { FRAME_STYLES, newWindowFile, STARTERS, windowNameOf, type WindowStart } from './dataWindows';
import type { StudioWindow } from './windows';

const START: WindowStart = { title: '', starter: 'card', width: 320, height: 200, frameStyle: '3', heading: '', text: '', image: '', meMenu: true };

/**
 * A new window of the theme's own, defined as data (no code): from a starter (an info card, a dialog,
 * a list), blank at a size, or a copy of a window of the game as the theme draws it. It opens in the
 * studio to be changed like any window; players open it from the me menu entry it is given.
 */
export const NewWindowDialog = ({ open, onClose, theme, taken, windows, source, onCreate }: {
    open: boolean;
    onClose: () => void;
    theme: string;
    /** The theme's window names already used. */
    taken: readonly string[];
    /** The windows a copy can be made of. */
    windows: readonly StudioWindow[];
    /** A window's template as the client draws it, from the preview. */
    source: (template: string) => Promise<DataWindowTemplate | null>;
    onCreate: (name: string, file: DataWindowFile) => void;
}) => {
    const [ start, setStart ] = useState<WindowStart>(START);
    const [ copyOf, setCopyOf ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const set = (changes: Partial<WindowStart>) => setStart(was => ({ ...was, ...changes }));
    const name = windowNameOf(start.title || 'New window', taken);
    const copyable = windows.filter(window => window.template);

    const create = async () => {
        setBusy(true);

        try {
            const copy = start.starter === 'copy' ? await source(copyOf) : undefined;

            if (start.starter === 'copy' && !copy) throw new Error('The preview could not give that window\'s layout: wait for it to show the game, then try again.');

            onCreate(name, newWindowFile(start, copy ?? undefined));
            setStart(START);
            onClose();
        } catch (failure) {
            toastError(failure);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal title="New window" open={open} onClose={onClose}>
            <div className="flex flex-col gap-4 p-5" data-testid="new-window">
                <Labeled label="Title" hint="Shown in its header, and on its me menu entry">
                    <Input value={start.title} onChange={event => set({ title: event.target.value })} placeholder="Welcome" autoFocus />
                </Labeled>
                <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted">Start from</span>
                    <Segmented label="Start from" value={start.starter} onChange={value => set({ starter: value as WindowStart['starter'] })} options={STARTERS.map(each => ({ value: each.value, label: each.label }))} />
                    <span className="text-xs text-muted">{STARTERS.find(each => each.value === start.starter)?.hint}</span>
                </div>
                {start.starter === 'copy'
                    ? (
                            <Labeled label="Window to copy">
                                <Select value={copyOf} onChange={event => setCopyOf(event.target.value)}>
                                    <option value="">Pick a window</option>
                                    {copyable.map(window => <option key={window.id} value={window.id}>{`${window.name} (${window.area})`}</option>)}
                                </Select>
                            </Labeled>
                        )
                    : (
                            <Labeled label="Frame">
                                <Select value={start.frameStyle} onChange={event => set({ frameStyle: event.target.value })}>
                                    {FRAME_STYLES.map(each => <option key={each.value} value={each.value}>{each.label}</option>)}
                                </Select>
                            </Labeled>
                        )}
                {start.starter === 'blank' && (
                    <div className="grid grid-cols-2 gap-3">
                        <Labeled label="Width"><Input type="number" min={60} max={1000} value={start.width} onChange={event => set({ width: Number(event.target.value) || 60 })} /></Labeled>
                        <Labeled label="Height"><Input type="number" min={60} max={700} value={start.height} onChange={event => set({ height: Number(event.target.value) || 60 })} /></Labeled>
                    </div>
                )}
                {(start.starter === 'card' || start.starter === 'list') && (
                    <Labeled label="Heading">
                        <Input value={start.heading} onChange={event => set({ heading: event.target.value })} placeholder="Welcome to the hotel!" />
                    </Labeled>
                )}
                {(start.starter === 'card' || start.starter === 'dialog') && (
                    <Labeled label="Text">
                        <Textarea rows={3} value={start.text} onChange={event => set({ text: event.target.value })} />
                    </Labeled>
                )}
                {start.starter === 'card' && (
                    <Labeled label="Picture">
                        <ImageInput value={start.image} onChange={image => set({ image })} accept={{ shapes: [ 'plugin', 'libraryUrl', 'url' ], plugin: theme, usedIn: 'theme.window' }} title="Pick the window's picture" />
                    </Labeled>
                )}
                <Checkbox label="Players open it from the me menu" checked={start.meMenu} onChange={meMenu => set({ meMenu })} />
                <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button icon={<Plus />} disabled={busy || (start.starter === 'copy' && !copyOf)} onClick={() => void create()} data-testid="new-window-create">Create</Button>
                </div>
            </div>
        </Modal>
    );
};
