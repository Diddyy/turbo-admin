import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { promoImageUrl, useClientAssets } from '#/api/assets';
import { type ExpiringPage, useDeleteExpiringPage, useExpiringPages, useHotelViewTexts, useSaveExpiringPage, useSaveHotelView } from '#/api/hotelView';
import { ask } from '#/components/confirm';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, Panel } from '#/components/ui';

import type { HotelViewDraft } from './draft';
import { inputToIso, isoTime, isoToInput, pageExpiryTextKey } from './model';
import { PageField } from './parts';
import { Placement } from './Placement';

/** What the widget says of a page, and its teaser picture: both found by the page's name. */
const PageWords = ({ page, disabled }: { page: ExpiringPage; disabled?: boolean }) => {
    const assets = useClientAssets();
    const keys = [ pageExpiryTextKey(page.pageName, 'header'), pageExpiryTextKey(page.pageName, 'desc') ];
    const { data } = useHotelViewTexts(keys);
    const save = useSaveHotelView();
    const [ edits, setEdits ] = useState<Record<string, string>>({});
    const value = (key: string) => edits[key] ?? data?.texts.find(x => x.key === key)?.value ?? '';
    const teaser = promoImageUrl(assets, `reception/catalog_teaser_${page.pageName}.png`);

    return (
        <div className="flex flex-wrap gap-4">
            <figure className="flex flex-col items-center gap-1">
                <span className="grid size-28 place-items-center rounded-lg border border-line bg-[#aae0f0]">
                    {teaser && <img src={teaser} alt="" className="max-h-full max-w-full" onError={event => (event.currentTarget.style.display = 'none')} />}
                </span>
                <figcaption className="max-w-28 truncate font-mono text-[11px] text-muted" title={`reception/catalog_teaser_${page.pageName}.png`}>catalog_teaser_{page.pageName}.png</figcaption>
            </figure>
            <div className="flex min-w-60 flex-1 flex-col gap-3">
                {keys.map((key, i) => (
                    <Labeled key={key} label={i === 0 ? 'Heading' : 'Text'} hint={key}>
                        <Input value={value(key)} onChange={event => setEdits(previous => ({ ...previous, [key]: event.target.value }))} disabled={disabled} />
                    </Labeled>
                ))}
                {!disabled && (
                    <div>
                        <Button
                            variant="secondary"
                            icon={<Save />}
                            disabled={Object.keys(edits).length === 0 || save.isPending}
                            onClick={() => save.mutate(
                                { variables: {}, texts: Object.fromEntries(Object.entries(edits).map(([ key, text ]) => [ key, text === '' ? null : text ])) },
                                { onSuccess: () => setEdits({}) },
                            )}
                        >
                            Save the words
                        </Button>
                    </div>
                )}
                {save.error && <ErrorNotice error={save.error} />}
            </div>
        </div>
    );
};

/** One page's expiry: when it runs out, moved or taken away. */
const ExpiryRow = ({ page, now, disabled }: { page: ExpiringPage; now: number; disabled?: boolean }) => {
    const [ at, setAt ] = useState(isoToInput(page.expiresAt));
    const save = useSaveExpiringPage();
    const remove = useDeleteExpiringPage();
    const over = (isoTime(page.expiresAt) ?? 0) <= now;

    return (
        <li className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-end gap-3">
                <span className="min-w-40 flex-1 font-mono text-sm">{page.pageName}</span>
                {over && <Badge>Over</Badge>}
                <Labeled label="Runs out (UTC)">
                    <Input type="datetime-local" value={at} onChange={event => setAt(event.target.value)} disabled={disabled} />
                </Labeled>
                {!disabled && (
                    <>
                        <Button variant="secondary" icon={<Save />} disabled={at === isoToInput(page.expiresAt) || !at || save.isPending} onClick={() => save.mutate({ pageId: page.pageId, expiresAt: inputToIso(at)!, image: page.image })}>Save</Button>
                        <Button variant="ghost" icon={<Trash2 />} className="text-bad hover:text-bad" disabled={remove.isPending} onClick={() => ask({ title: `Stop counting down to ${page.pageName}?`, confirm: 'Remove', danger: true }, () => remove.mutate(page.pageId))}>Remove</Button>
                    </>
                )}
            </div>
            <PageWords page={page} disabled={disabled} />
            {(save.error || remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
        </li>
    );
};

/**
 * The catalogue pages the expiring page widget counts down to: it shows the one that runs out
 * first among those still to come, with its own heading, text and teaser picture, and opens it.
 * Above them, which slot shows it. Saved at once.
 */
export const ExpiringPagesTab = ({ draft, now, onOpenSlot, disabled }: { draft: HotelViewDraft; now: number; onOpenSlot: (slot: number) => void; disabled?: boolean }) => {
    const { data, error } = useExpiringPages();
    const save = useSaveExpiringPage();
    const [ pageId, setPageId ] = useState<number | null>(null);
    const [ at, setAt ] = useState('');
    const pages = data?.pages ?? [];
    const shown = pages.filter(x => (isoTime(x.expiresAt) ?? 0) > now)[0];

    return (
        <div className="flex flex-col gap-4">
            <Placement draft={draft} widget="expiringcatalogpage" narrowWidget="expiringcatalogpagesmall" what="the expiring page countdown" onOpenSlot={onOpenSlot} disabled={disabled} />
            <Panel
                title="Expiring pages"
                description={shown ? `Counting down to ${shown.pageName} now. The page stays in the catalogue: the widget only promotes it.` : 'No page counts down now: the widget hides itself.'}
                className="overflow-clip"
            >
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!data && !error && <Loading />}
                {data && pages.length === 0 && <EmptyState>No page counts down.</EmptyState>}
                <ul className="divide-y divide-line">
                    {pages.map(page => <ExpiryRow key={`${page.pageId}|${page.expiresAt}`} page={page} now={now} disabled={disabled} />)}
                </ul>
                {!disabled && (
                    <form
                        className="flex flex-wrap items-end gap-3 border-t border-line p-4"
                        onSubmit={(event) => {
                            event.preventDefault();

                            if (pageId !== null && at) save.mutate({ pageId, expiresAt: inputToIso(at)!, image: '' }, { onSuccess: () => setAt('') });
                        }}
                    >
                        <div className="min-w-60 flex-1"><PageField label="Page" hint="It needs a name: the client opens it, and finds its words and teaser, by it." value={pageId} onChange={setPageId} /></div>
                        <Labeled label="Runs out (UTC)"><Input type="datetime-local" value={at} onChange={event => setAt(event.target.value)} /></Labeled>
                        <Button type="submit" variant="secondary" icon={<Plus />} disabled={pageId === null || !at || save.isPending}>Count down to it</Button>
                    </form>
                )}
                {save.error && <div className="px-4 pb-4"><ErrorNotice error={save.error} /></div>}
            </Panel>
        </div>
    );
};
