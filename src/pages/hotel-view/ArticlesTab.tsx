import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { promoImageUrl, useClientAssets } from '#/api/assets';
import { ARTICLE_LINK_TYPES, type PromoArticle, type PromoArticleDraft, useDeletePromoArticle, usePromoArticles, useReorderPromoArticles, useSavePromoArticle } from '#/api/hotelView';
import { ask } from '#/components/confirm';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Select, Switch, Textarea } from '#/components/ui';

import type { HotelViewDraft } from './draft';
import { inputToIso, isoTime, isoToInput } from './model';
import { ImageField } from './parts';
import { Placement } from './Placement';

const EMPTY: PromoArticleDraft = { title: '', bodyText: '', buttonText: '', linkType: 1, linkContent: '', imageUrl: '', visible: true, startsAt: null, endsAt: null };

/** Whether players see it at the time: shown, and within its dates. */
const isLive = (article: PromoArticleDraft, now: number) => article.visible
    && (isoTime(article.startsAt) ?? -Infinity) <= now
    && (isoTime(article.endsAt) ?? Infinity) > now;

/** The article as the client's carousel shows it, near enough to judge by. */
const ArticlePreview = ({ article }: { article: PromoArticleDraft }) => {
    const assets = useClientAssets();
    const image = promoImageUrl(assets, article.imageUrl);
    const button = article.linkType !== 2 && !(article.linkType === 0 && !article.linkContent);

    return (
        <div className="flex w-full max-w-[520px] gap-3 rounded-lg bg-[#f4f1df] p-3 text-[#222]">
            {image && <img src={image} alt="" className="max-h-40 max-w-[45%] object-contain" />}
            <div className="flex min-w-0 flex-col gap-1">
                <p className="text-[14px] font-bold">{article.title || 'Title'}</p>
                <p className="text-[12px] whitespace-pre-line">{article.bodyText}</p>
                {button && <span className="mt-1 self-start rounded-md border-2 border-[#2d6e15] bg-gradient-to-b from-[#8cd04e] to-[#4c9a1f] px-3 py-1 text-[12px] font-bold text-white">{article.buttonText || '…'}</span>}
            </div>
        </div>
    );
};

/** One article to write: what it says, its picture, its button and when it shows. */
const ArticleEditor = ({ article, onDone, disabled }: { article: PromoArticle | null; onDone: () => void; disabled?: boolean }) => {
    const assets = useClientAssets();
    const [ draft, setDraft ] = useState<PromoArticleDraft>(() => (article ? { ...article } : EMPTY));
    const save = useSavePromoArticle();
    const remove = useDeletePromoArticle();
    const set = (change: Partial<PromoArticleDraft>) => setDraft(previous => ({ ...previous, ...change }));

    return (
        <form
            className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto]"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ ...draft, id: article?.id ?? null }, { onSuccess: onDone });
            }}
        >
            <div className="flex min-w-0 flex-col gap-3">
                <Labeled label="Title"><Input value={draft.title} onChange={event => set({ title: event.target.value })} disabled={disabled} autoFocus={!article} /></Labeled>
                <Labeled label="Text"><Textarea value={draft.bodyText} onChange={event => set({ bodyText: event.target.value })} rows={4} disabled={disabled} /></Labeled>
                <ImageField
                    label="Picture"
                    hint="Its path under the client's image library, such as web_promo/summer.png."
                    placeholder="web_promo/summer.png"
                    value={draft.imageUrl}
                    onChange={value => set({ imageUrl: value })}
                    resolve={path => promoImageUrl(assets, path) ?? ''}
                    disabled={disabled}
                />
                <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                    <Labeled label="Button">
                        <Select value={String(draft.linkType)} onChange={event => set({ linkType: Number(event.target.value) })} disabled={disabled}>
                            {Object.entries(ARTICLE_LINK_TYPES).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                        </Select>
                    </Labeled>
                    {draft.linkType !== 2 && (
                        <Labeled label={draft.linkType === 0 ? 'Address' : 'Client link'} hint={draft.linkType === 0 ? 'Players are told they are leaving the hotel first.' : 'Such as catalog/open/summer or navigator/goto/123.'}>
                            <Input value={draft.linkContent} onChange={event => set({ linkContent: event.target.value })} className="w-full font-mono text-xs" disabled={disabled} />
                        </Labeled>
                    )}
                </div>
                {draft.linkType !== 2 && <Labeled label="Button text"><Input value={draft.buttonText} onChange={event => set({ buttonText: event.target.value })} disabled={disabled} /></Labeled>}
                <div className="grid gap-3 sm:grid-cols-3">
                    <Switch label="Shown" checked={draft.visible} onChange={visible => set({ visible })} disabled={disabled} />
                    <Labeled label="From (UTC)" hint="Empty: at once.">
                        <Input type="datetime-local" value={isoToInput(draft.startsAt)} onChange={event => set({ startsAt: inputToIso(event.target.value) })} disabled={disabled} />
                    </Labeled>
                    <Labeled label="Until (UTC)" hint="Empty: for good.">
                        <Input type="datetime-local" value={isoToInput(draft.endsAt)} onChange={event => set({ endsAt: inputToIso(event.target.value) })} disabled={disabled} />
                    </Labeled>
                </div>
                {!disabled && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button type="submit" icon={article ? <Save /> : <Plus />} disabled={save.isPending || !draft.title.trim()}>{article ? 'Save' : 'Add'}</Button>
                        <Button variant="ghost" icon={<X />} onClick={onDone}>Cancel</Button>
                        {article && (
                            <Button
                                variant="ghost"
                                icon={<Trash2 />}
                                className="ml-auto text-bad hover:text-bad"
                                disabled={remove.isPending}
                                onClick={() => ask({ title: `Remove the article "${article.title}"?`, confirm: 'Remove' }, () => remove.mutate(article.id, { onSuccess: onDone }))}
                            >
                                Remove
                            </Button>
                        )}
                    </div>
                )}
                {(save.error || remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
            </div>
            <aside className="flex min-w-0 flex-col gap-2">
                <span className="text-xs font-medium text-muted">As the carousel shows it</span>
                <ArticlePreview article={draft} />
            </aside>
        </form>
    );
};

/**
 * The reception's promo articles: the carousel a slot holding the "Promo articles" widget shows,
 * the live ones in order, ten at most. Each is saved on its own, at once. Above them, which slot
 * shows them.
 */
export const ArticlesTab = ({ draft, now, onOpenSlot, disabled }: { draft: HotelViewDraft; now: number; onOpenSlot: (slot: number) => void; disabled?: boolean }) => {
    const { data, error } = usePromoArticles();
    const reorder = useReorderPromoArticles();
    const [ open, setOpen ] = useState<number | 'new' | null>(null);
    const articles = data?.articles ?? [];
    const move = (index: number, to: number) => {
        const ids = articles.map(x => x.id);
        const [ id ] = ids.splice(index, 1);

        if (id === undefined) return;

        ids.splice(to, 0, id);
        reorder.mutate(ids);
    };

    return (
        <div className="flex flex-col gap-4">
            <Placement draft={draft} widget="promoarticle" what="the promo articles" onOpenSlot={onOpenSlot} disabled={disabled} />
            <Panel
                title="Promo articles"
                description="The live ones, in this order, ten at most, as a carousel. Saved at once, each on its own."
                actions={!disabled && <Button variant="secondary" icon={<Plus />} onClick={() => setOpen('new')} disabled={open === 'new'}>New article</Button>}
                className="overflow-clip"
            >
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!data && !error && <Loading />}
                {open === 'new' && <div className="border-b border-line bg-subtle/40 p-4"><ArticleEditor article={null} onDone={() => setOpen(null)} disabled={disabled} /></div>}
                {data && articles.length === 0 && open !== 'new' && <EmptyState>No articles yet.</EmptyState>}
                <ul className="divide-y divide-line">
                    {articles.map((article, index) => (
                        <li key={article.id}>
                            <div className="flex items-center gap-3 px-4 py-2.5">
                                <button type="button" onClick={() => setOpen(open === article.id ? null : article.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                                    <span className="w-5 text-right font-mono text-xs text-muted">{index + 1}</span>
                                    <span className="truncate text-sm font-medium">{article.title}</span>
                                    {isLive(article, now)
                                        ? <Badge tone="green">Live</Badge>
                                        : <Badge tone="neutral">{!article.visible ? 'Hidden' : (isoTime(article.startsAt) ?? 0) > now ? 'Not yet' : 'Over'}</Badge>}
                                </button>
                                {!disabled && (
                                    <span className="flex">
                                        <IconButton label="Up" icon={<ArrowUp />} disabled={index === 0 || reorder.isPending} onClick={() => move(index, index - 1)} />
                                        <IconButton label="Down" icon={<ArrowDown />} disabled={index === articles.length - 1 || reorder.isPending} onClick={() => move(index, index + 1)} />
                                    </span>
                                )}
                            </div>
                            {open === article.id && <div className="border-t border-line bg-subtle/40 p-4"><ArticleEditor key={JSON.stringify(article)} article={article} onDone={() => setOpen(null)} disabled={disabled} /></div>}
                        </li>
                    ))}
                </ul>
                {reorder.error && <div className="p-4"><ErrorNotice error={reorder.error} /></div>}
            </Panel>
        </div>
    );
};
