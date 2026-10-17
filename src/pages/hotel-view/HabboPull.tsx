import { CloudDownload } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { type HotelViewHabboEntry, useHabboHotelView, useHabboHotelViewTexts } from '#/api/hotelView';
import { Modal } from '#/components/Modal';
import { Badge, Button, Checkbox, EmptyState, ErrorNotice, Loading } from '#/components/ui';
import { fromNow } from '#/lib/time';

import type { HotelViewDraft } from './draft';
import { CATALOG_PROMO_TEXTS, elementTextKeys, parseConf, readValue } from './model';

/** The texts a reception's variables show: each column's elements', the slots' headings, the catalogue promo's. */
const textKeysOf = (variables: HotelViewHabboEntry[]) => [ ...new Set([
    ...variables.flatMap(x => (x.key.endsWith('.conf')
        ? parseConf(readValue(x.value)).flatMap(elementTextKeys)
        : x.key.endsWith('.title') ? [ readValue(x.value) ] : [])),
    ...CATALOG_PROMO_TEXTS.map(x => x.key),
]) ].filter(Boolean).sort();

const Change = ({ entry, text }: { entry: HotelViewHabboEntry; text?: boolean }) => (
    <li className="grid gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[4.5rem_minmax(10rem,1fr)_2fr]">
        <span><Badge tone={entry.current === null ? 'green' : 'accent'}>{entry.current === null ? 'new' : 'changed'}</Badge></span>
        <span className="min-w-0 truncate font-mono text-xs" title={entry.key}>{entry.key}</span>
        <span className="flex min-w-0 flex-col gap-0.5 font-mono text-xs break-words">
            {entry.current !== null && <span className="text-muted line-through decoration-muted/50">{text ? entry.current : readValue(entry.current)}</span>}
            <span>{text ? entry.value : readValue(entry.value)}</span>
        </span>
    </li>
);

const Section = ({ title, count, children }: { title: string; count: number; children: ReactNode }) => (
    <section className="flex flex-col">
        <h3 className="flex items-center gap-2 border-b border-line bg-canvas/60 px-4 py-2 font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase">
            {title}
            <span className="rounded-full bg-subtle px-1.5 text-[11px] tabular-nums">{count.toLocaleString()}</span>
        </h3>
        <ul className="divide-y divide-line">{children}</ul>
    </section>
);

/**
 * Habbo's reception as its external variables have it now, read from Habbo when opened, against
 * the hotel's: the variables it would change or add, the texts its promos show (from the newest of
 * Habbo's texts the hotel has found), and - when asked - the hotel's reception variables Habbo has
 * none of, to remove. Taking it puts all of it among the editor's changes, to look at in the
 * preview and save as any edit: one change set, which rolls back as one.
 */
export const HabboPull = ({ open, onClose, draft }: { open: boolean; onClose: () => void; draft: HotelViewDraft }) => {
    const { data: preview, error, isFetching } = useHabboHotelView(open);
    const [ removeMissing, setRemoveMissing ] = useState(false);
    const variables = useMemo(() => (preview?.variables ?? []).filter(x => x.value !== x.current), [ preview ]);
    const keys = useMemo(() => textKeysOf(preview?.variables ?? []), [ preview ]);
    const { data: texts, error: textsError } = useHabboHotelViewTexts(keys, open && !!preview);
    const textChanges = (texts?.texts ?? []).filter(x => x.value !== x.current);
    const missing = preview?.missing ?? [];
    const total = variables.length + textChanges.length + (removeMissing ? missing.length : 0);

    const take = () => {
        draft.setMany({
            ...Object.fromEntries(variables.map(x => [ x.key, x.value ])),
            ...(removeMissing ? Object.fromEntries(missing.map(key => [ key, null ])) : {}),
        });

        for (const text of textChanges)
            draft.setPhrase(text.key, text.value);

        onClose();
    };

    return (
        <Modal open={open} onClose={onClose} title={preview ? `Habbo's hotel view, from habbo.${preview.domain}` : 'Habbo\'s hotel view'} className="sm:h-fit! sm:max-w-4xl">
            {error && <div className="p-5"><ErrorNotice error={error} /></div>}
            {!preview && !error && <Loading />}
            {preview && (
                <div className="flex flex-col">
                    <p className="px-4 py-3 text-[13px] text-muted sm:px-5">
                        What Habbo's reception has that yours doesn't. Taking it puts it among your changes: look at it in the preview, then save it as any edit, or discard it.
                    </p>
                    <div className="max-h-[55dvh] overflow-y-auto border-y border-line">
                        {variables.length === 0 && textChanges.length === 0 && missing.length === 0 && <EmptyState>Your reception is Habbo's already.</EmptyState>}
                        {variables.length > 0 && (
                            <Section title="Variables" count={variables.length}>
                                {variables.map(entry => <Change key={entry.key} entry={entry} />)}
                            </Section>
                        )}
                        {textChanges.length > 0 && (
                            <Section title="Texts its promos show" count={textChanges.length}>
                                {textChanges.map(entry => <Change key={entry.key} entry={entry} text />)}
                            </Section>
                        )}
                        {missing.length > 0 && (
                            <Section title="Yours that Habbo has none of" count={missing.length}>
                                {missing.map(key => (
                                    <li key={key} className="grid gap-x-3 px-4 py-2.5 sm:grid-cols-[4.5rem_minmax(10rem,1fr)]">
                                        <span><Badge tone={removeMissing ? 'red' : 'neutral'}>{removeMissing ? 'remove' : 'kept'}</Badge></span>
                                        <span className="min-w-0 truncate font-mono text-xs">{key}</span>
                                    </li>
                                ))}
                            </Section>
                        )}
                    </div>
                    {textsError && <div className="px-4 pt-3 sm:px-5"><ErrorNotice error={textsError} /></div>}
                    <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
                        {keys.length > 0 && (
                            <p className="text-xs text-muted">
                                {texts?.checkedAt
                                    ? `Texts from Habbo's texts as last found, ${fromNow(texts.checkedAt)}.`
                                    : texts ? 'Habbo\'s texts haven\'t been found yet: check Habbo on the Habbo updates page to bring the promos\' words too.' : 'Reading Habbo\'s texts…'}
                            </p>
                        )}
                        {missing.length > 0 && (
                            <Checkbox
                                label="Also remove the ones of yours Habbo has none of"
                                hint="Your own promos and slots go with them; leave it off to keep them."
                                checked={removeMissing}
                                onChange={setRemoveMissing}
                            />
                        )}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button icon={<CloudDownload />} disabled={total === 0 || isFetching} onClick={take}>
                                {total > 0 ? `Take ${total.toLocaleString()} ${total === 1 ? 'change' : 'changes'}` : 'Nothing to take'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};
