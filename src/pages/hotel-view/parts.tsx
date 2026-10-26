import { CalendarClock, ImageOff, Plus, Trash2 } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

import { useCatalogTree } from '#/api/catalog';
import type { ImageAccept } from '#/api/media';
import { ImageInput } from '#/components/ImageInput';
import { Badge, Button, IconButton, Input, Labeled, Select } from '#/components/ui';
import { cx } from '#/lib/cx';

import type { HotelViewDraft } from './draft';
import { currentCode, formatSchedule, fromLocalInput, LIBRARY_ADDRESS, parseSchedule, parseTime, type ScheduleEntry, toLocalInput } from './model';

/** A dot beside what has changed since it was saved. */
export const Changed = ({ on }: { on: boolean }) => (on ? <span title="Not saved yet" className="inline-block size-1.5 shrink-0 rounded-full bg-accent" /> : null);

/** A picture's address, picked in the image picker, with the picture beside it as the client would load it. */
export const ImageField = ({ label, hint, value, onChange, resolve, changed, disabled, accept = LIBRARY_ADDRESS }: {
    label: string;
    hint?: ReactNode;
    accept?: ImageAccept;
    value: string;
    onChange: (value: string) => void;
    resolve: (uri: string) => string;
    changed?: boolean;
    disabled?: boolean;
}) => {
    const url = resolve(value);
    const [ failed, setFailed ] = useState<string | null>(null);

    return (
        <div className="flex gap-3">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-[repeating-conic-gradient(var(--color-subtle)_0_25%,transparent_0_50%)] bg-[length:12px_12px]">
                {url && failed !== url
                    ? <img src={url} alt="" className="max-h-full max-w-full object-contain [image-rendering:pixelated]" onError={() => setFailed(url)} />
                    : <ImageOff className={cx('size-5', value.trim() ? 'text-warn' : 'text-muted/50')} aria-label={value.trim() ? 'Could not load the picture' : 'No picture'} />}
            </div>
            <Labeled label={label} hint={failed === url && url ? <span className="text-warn">The picture could not be loaded from {url}.</span> : hint} className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <ImageInput value={value} onChange={onChange} accept={accept} title={label} resolve={resolve} preview={false} disabled={disabled} className="flex-1" />
                    <Changed on={!!changed} />
                </div>
            </Labeled>
        </div>
    );
};

/**
 * A schedule: from each time (UTC) on, the code given shows, until a later one starts. The entry
 * showing at the preview's time is marked.
 */
export const ScheduleEditor = ({ value, onChange, codes, now, emptyLabel, disabled, onOpen }: {
    value: string;
    onChange: (value: string) => void;
    codes: string[];
    now: number;
    /** What shows while no entry has started. */
    emptyLabel: string;
    disabled?: boolean;
    /** Opens what a code names, when it can be opened. */
    onOpen?: (code: string) => void;
}) => {
    const entries = parseSchedule(value);
    const showing = currentCode(entries, now);
    const set = (next: ScheduleEntry[]) => onChange(formatSchedule(next));
    const listId = useId();

    return (
        <div className="flex flex-col gap-2">
            {entries.length === 0 && <p className="text-sm text-muted">Nothing scheduled: {emptyLabel}.</p>}
            {entries.length > 0 && showing.index < 0 && <p className="text-xs text-muted">Nothing has started at the preview time: {emptyLabel}.</p>}
            {entries.map((entry, index) => {
                const bad = entry.at.trim() !== '' && parseTime(entry.at) === null;

                return (
                    <div key={index} className={cx('flex flex-wrap items-center gap-2 rounded-lg border p-2', showing.index === index ? 'border-accent bg-accent-soft/40' : 'border-line')}>
                        <CalendarClock className="size-4 shrink-0 text-muted" />
                        <Input
                            type="datetime-local"
                            value={toLocalInput(entry.at)}
                            onChange={event => set(entries.map((x, i) => (i === index ? { ...x, at: fromLocalInput(event.target.value) } : x)))}
                            className={cx('min-w-0 flex-1 sm:w-56 sm:flex-none', bad && 'border-warn')}
                            disabled={disabled}
                            aria-label="Starts at (UTC)"
                        />
                        <span className="text-xs text-muted">UTC</span>
                        <Input
                            value={entry.code}
                            onChange={event => set(entries.map((x, i) => (i === index ? { ...x, code: event.target.value.trim() } : x)))}
                            list={listId}
                            placeholder="code"
                            className="w-48 min-w-0 flex-1 font-mono text-xs"
                            disabled={disabled}
                            aria-label="Code"
                        />
                        {showing.index === index && <Badge tone="accent">Showing</Badge>}
                        {onOpen && entry.code && codes.includes(entry.code) && <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => onOpen(entry.code)}>Open</Button>}
                        {!disabled && <IconButton label="Remove" icon={<Trash2 />} tone="bad" onClick={() => set(entries.filter((_, i) => i !== index))} />}
                    </div>
                );
            })}
            <datalist id={listId}>
                {codes.map(code => <option key={code} value={code} />)}
            </datalist>
            {!disabled && (
                <div>
                    <Button
                        variant="secondary"
                        icon={<Plus />}
                        onClick={() => set([ ...entries, { at: new Date(now).toISOString().slice(0, 16).replace('T', ' '), code: codes[0] ?? '' } ])}
                    >
                        Add to the schedule
                    </Button>
                </div>
            )}
        </div>
    );
};

/** A choice of code from those there are, or none. */
export const CodeSelect = ({ value, codes, onChange, label, disabled }: { value: string; codes: string[]; onChange: (code: string) => void; label: string; disabled?: boolean }) => (
    <Select value={value} onChange={event => onChange(event.target.value)} aria-label={label} disabled={disabled} className="font-mono text-xs">
        {codes.map(code => <option key={code} value={code}>{code}</option>)}
    </Select>
);

/**
 * A text the client shows, by its key in the external texts: the key, and the text itself, which
 * is saved with the hotel view.
 */
export const TextKeyField = ({ label, textKey, onKeyChange, draft, disabled }: {
    label: string;
    textKey: string;
    onKeyChange: (key: string) => void;
    draft: HotelViewDraft;
    disabled?: boolean;
}) => {
    const phrase = textKey ? draft.phrase(textKey) : undefined;

    return (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,16rem)_1fr]">
            <Labeled label={`${label}: text key`}>
                <Input value={textKey} onChange={event => onKeyChange(event.target.value.trim())} className="w-full font-mono text-xs" disabled={disabled} spellCheck={false} />
            </Labeled>
            <Labeled
                label="What it says"
                hint={!textKey ? 'Give it a key first.' : phrase === undefined ? 'The hotel has no such text: the client shows the key. Type one to add it.' : 'A line break is written \\n. Saved to the external texts with the hotel view.'}
            >
                <div className="flex items-center gap-2">
                    <Input
                        value={phrase ?? ''}
                        onChange={event => draft.setPhrase(textKey, event.target.value === '' && phrase === undefined ? null : event.target.value)}
                        className="w-full"
                        disabled={disabled || !textKey}
                    />
                    <Changed on={!!textKey && draft.phraseChanged(textKey)} />
                </div>
            </Labeled>
        </div>
    );
};

/** A catalog page to pick, by name, from the catalog's tree; typed by id without access to it. */
export const PageField = ({ label, hint, value, onChange }: { label: string; hint: string; value: number | null; onChange: (id: number | null) => void }) => {
    const { data: tree } = useCatalogTree();

    if (!tree)
        return (
            <Labeled label={`${label} (page id)`} hint={hint}>
                <Input value={value ?? ''} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)} inputMode="numeric" />
            </Labeled>
        );

    return (
        <Labeled label={label} hint={hint}>
            <Select value={value ?? ''} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}>
                <option value="">None</option>
                {tree.pages.filter(x => x.id !== tree.rootId).map(page => <option key={page.id} value={page.id}>{page.localization}{page.name ? ` (${page.name})` : ''}</option>)}
            </Select>
        </Labeled>
    );
};
