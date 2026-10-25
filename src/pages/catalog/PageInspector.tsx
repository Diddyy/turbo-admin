import { EyeOff, FolderPlus, FolderTree, Hammer, Layers, LayoutTemplate, Merge, RotateCcw, Save, Store, Trash2, X } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react';

import { catalogImageUrl, useClientAssets } from '#/api/assets';
import { catalogCalls, type CatalogPageDetail, type CatalogTree, type PageDisplay, useCatalogEdit } from '#/api/catalog';
import { findImage, useAllCatalogImages } from '#/api/catalogImages';
import { ask } from '#/components/confirm';
import { toast } from '#/components/toast';
import { Button, ErrorNotice, Field, IconButton, Input, Label, Labeled, Switch, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

import { CatalogImageThumb, CHECKS } from './CatalogImageThumb';
import { IconPicker } from './IconPicker';
import { ImagePicker } from './ImagePicker';
import { DISPLAY_LABELS, inBuildersClub } from './labels';
import { LayoutPicker } from './LayoutPicker';
import { isKnownLayout, layoutOf } from './layouts';
import { LINK_KEYS, linkKeyNote } from './linkKeys';
import { MergePagesDialog } from './MergePagesDialog';
import { type PageDraft, pageDraftOf, withSlot } from './pageDraft';
import type { SlotRef } from './PagePreview';
import { PageIcon } from './PageTree';
import { ResortPageDialog } from './ResortPageDialog';

const DISPLAYS: { value: PageDisplay; icon: ReactNode; hint: string }[] = [
    { value: 'regular', icon: <Store />, hint: 'The normal catalog.' },
    { value: 'both', icon: <Layers />, hint: 'Both catalogs.' },
    { value: 'bc_only', icon: <Hammer />, hint: 'The Builders Club catalog only.' },
    { value: 'invisible', icon: <EyeOff />, hint: 'No navigation; links by its name still open it.' },
];

const Section = ({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) => (
    <section className="flex flex-col gap-3 border-t border-line px-4 py-4 first:border-t-0">
        <div className="flex items-center justify-between gap-2">
            <Label as="h3">{title}</Label>
            {action}
        </div>
        {children}
    </section>
);

/**
 * One picture's place: the picture, found by name among those the server keeps, and the picture
 * beside it - the server's own file, or else the client's host's, for one the server lacks.
 */
const ImageField = ({ id, label, hint, value, onChange, disabled, highlight }: { id: string; label: string; hint?: string; value: string; onChange: (value: string) => void; disabled: boolean; highlight: boolean }) => {
    const url = catalogImageUrl(useClientAssets(), value);
    const image = findImage(useAllCatalogImages().data?.items, value);

    return (
        <div className={cx('flex gap-3 rounded-lg p-1 transition-colors', highlight && 'bg-accent-soft ring-2 ring-accent')}>
            {image
                ? <CatalogImageThumb image={image} className="size-16" />
                : (
                        <span className={cx('grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-line', CHECKS)}>
                            {url && <img key={url} src={url} alt="" className="max-h-full max-w-full object-contain" onError={event => (event.currentTarget.style.display = 'none')} />}
                        </span>
                    )}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <label htmlFor={id} className="text-xs font-medium text-muted">{label}</label>
                <ImagePicker id={id} value={value} onChange={onChange} disabled={disabled} canUpload={!disabled} />
                {hint && <span className="text-[11px] text-muted">{hint}</span>}
            </div>
        </div>
    );
};

interface PageInspectorProps {
    tree: CatalogTree;
    page: CatalogPageDetail;
    draft: PageDraft;
    onDraft: (draft: PageDraft) => void;
    /** The place picked in the preview, to scroll to and light up while it is set. */
    focus: (SlotRef & { at: number }) | null;
    onOpen: (id: number | null) => void;
}

/**
 * One page's settings, laid out by what the client does with them: its title, the name the client
 * opens it by and its icon; which catalogs show it; its layout; and the pictures and words that
 * layout has places for, each named for where it shows. Values at places the layout has none are
 * listed apart, to clear. Below, a page under it, and deleting it, which only an empty page allows.
 * Saving is Save or Ctrl+S; until then the preview shows the edit and nothing is stored.
 */
export const PageInspector = ({ tree, page, draft, onDraft, focus, onOpen }: PageInspectorProps) => {
    const canManage = tree.canManage;
    const [ iconOpen, setIconOpen ] = useState(false);
    const [ layoutOpen, setLayoutOpen ] = useState(false);
    const [ mergeOpen, setMergeOpen ] = useState(false);
    const [ resortOpen, setResortOpen ] = useState(false);
    const linkKeysId = useId();
    const save = useCatalogEdit(catalogCalls.updatePage);
    const create = useCatalogEdit(catalogCalls.createPage);
    const remove = useCatalogEdit(catalogCalls.deletePage);
    const spec = layoutOf(draft.layout);
    const isRoot = page.parentId === null;
    // The Builders Club catalog has no tabs, so a tab is not shown there; the pages under it are.
    const isTab = page.parentId === tree.rootId;
    const dirty = JSON.stringify(draft) !== JSON.stringify(pageDraftOf(page));
    const leftoverImages = draft.imageData.map((value, index) => ({ value, index })).filter(x => x.value && !spec.images.some(s => s.index === x.index));
    const leftoverTexts = draft.textData.map((value, index) => ({ value, index })).filter(x => x.value && !spec.texts.some(s => s.index === x.index));

    const set = <K extends keyof PageDraft>(key: K, value: PageDraft[K]) => onDraft({ ...draft, [key]: value });

    const submit = (event?: FormEvent) => {
        event?.preventDefault();

        if (canManage && dirty && !save.isPending)
            save.mutate([ page.id, draft ], { onSuccess: () => toast(`Saved ${draft.localization}. Publish to put it live.`) });
    };

    // A place picked in the preview: bring its field into view and into focus.
    useEffect(() => {
        if (!focus)
            return;

        const field = document.getElementById(`slot-${focus.list}-${focus.index}`);

        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        field?.focus({ preventScroll: true });
    }, [ focus ]);

    // Ctrl+S saves the page, wherever the focus is.
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && dirty) {
                event.preventDefault();
                submit();
            }
        };

        window.addEventListener('keydown', onKey);

        return () => window.removeEventListener('keydown', onKey);
    });

    const highlight = (list: SlotRef['list'], index: number) => focus?.list === list && focus.index === index;

    return (
        <form onSubmit={submit} className="flex flex-col">
            <div className="grid md:grid-cols-2 md:divide-x md:divide-line">
                <div className="flex min-w-0 flex-col">
                    <Section title="Page">
                        <div className="flex items-end gap-2">
                            <button
                                type="button"
                                onClick={() => setIconOpen(true)}
                                disabled={!canManage}
                                title="Change the icon"
                                className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-canvas transition hover:scale-105 hover:border-accent disabled:pointer-events-none sm:size-8"
                            >
                                {draft.icon > 0 ? <PageIcon icon={draft.icon} /> : <span className="text-[10px] text-muted">icon</span>}
                            </button>
                            <div className="min-w-0 flex-1">
                                <Field label="Title" name="page-title" value={draft.localization} onChange={event => set('localization', event.target.value)} maxLength={50} required disabled={!canManage} />
                            </div>
                        </div>
                        <Field
                            label="Link key"
                            name="page-name"
                            value={draft.name ?? ''}
                            onChange={event => set('name', event.target.value || null)}
                            maxLength={50}
                            list={linkKeysId}
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="Pick one the client uses, or type your own"
                            hint={linkKeyNote(draft.name) ?? 'The name the client opens it by. Pick one the client\'s buttons use, or type your own for links.'}
                            disabled={!canManage}
                            className="font-mono"
                        />
                        <datalist id={linkKeysId}>
                            {LINK_KEYS.map(x => <option key={x.key} value={x.key}>{x.note}</option>)}
                        </datalist>
                    </Section>

                    <Section title="Shown in">
                        <div role="radiogroup" aria-label="Shown in" className="grid grid-cols-2 gap-1.5">
                            {DISPLAYS.map((x) => {
                                const blocked = isTab && inBuildersClub(x.value) && x.value !== page.display;

                                return (
                                    <button
                                        key={x.value}
                                        type="button"
                                        role="radio"
                                        aria-checked={draft.display === x.value}
                                        disabled={!canManage || blocked}
                                        title={blocked ? 'A tab can\'t be in the Builders Club catalog, which has no tabs.' : x.hint}
                                        onClick={() => set('display', x.value)}
                                        className={cx(
                                            'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition [&>svg]:size-4 [&>svg]:shrink-0',
                                            draft.display === x.value ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:border-muted/50 hover:text-ink',
                                            'disabled:opacity-40',
                                        )}
                                    >
                                        {x.icon}
                                        {DISPLAY_LABELS[x.value]}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-muted">
                            {DISPLAYS.find(x => x.value === draft.display)?.hint}
                            {inBuildersClub(draft.display) && !isTab && ' The pages above it are shown in the Builders Club catalog too, to lead to it, without their own offers.'}
                            {isTab && canManage && ' A tab can\'t be in the Builders Club catalog, which has no tabs.'}
                        </p>
                        {!isRoot && !isTab && (
                            <Switch
                                label="Folder only"
                                checked={draft.folderOnly ?? false}
                                onChange={on => set('folderOnly', on)}
                                disabled={!canManage}
                                hint={draft.folderOnly
                                    ? 'Clicking it opens and closes the pages under it and keeps the open page on show, as Habbo\'s "Hot now". Its layout and offers are never shown.'
                                    : 'Turn on for a heading that only holds pages, with no page of its own.'}
                            />
                        )}
                    </Section>

                    <Section title="Who sees it">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Labeled label="Lowest rank" hint="1 is every player. The pages under it are kept from lower ranks too.">
                                <Input
                                    name="page-min-rank"
                                    value={draft.minRank ?? 1}
                                    onChange={event => set('minRank', Math.max(1, Number(event.target.value.replace(/\D/g, '')) || 1))}
                                    inputMode="numeric"
                                    disabled={!canManage}
                                />
                            </Labeled>
                            <Labeled label="Needs the permission" hint="A permission node; empty: none. The pages under it need it too.">
                                <Input
                                    name="page-required-node"
                                    value={draft.requiredNode ?? ''}
                                    onChange={event => set('requiredNode', event.target.value)}
                                    placeholder="catalog.page.vip"
                                    spellCheck={false}
                                    autoComplete="off"
                                    className="font-mono text-xs"
                                    disabled={!canManage}
                                />
                            </Labeled>
                        </div>
                    </Section>

                    <Section title="Layout">
                        <button
                            type="button"
                            onClick={() => setLayoutOpen(true)}
                            disabled={!canManage}
                            className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3 text-left transition hover:border-accent hover:shadow-sm disabled:pointer-events-none"
                        >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><LayoutTemplate className="size-5" /></span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold">{spec.title}</span>
                                <span className="block text-xs text-muted">{spec.blurb}</span>
                                <span className="mt-1 block font-mono text-[11px] text-muted">{draft.layout}{!isKnownLayout(draft.layout) && ' · unknown to the client'}</span>
                            </span>
                            {canManage && <span className="text-xs font-medium text-accent">Change</span>}
                        </button>
                    </Section>

                    {canManage && (
                        <Section title="More">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="secondary"
                                    icon={<FolderPlus />}
                                    disabled={create.isPending}
                                    onClick={() => create.mutate([ { parentId: page.id, localization: 'New page', name: null, icon: 0, layout: 'default_3x3', imageData: [], textData: [], display: 'invisible' } ], {
                                        onSuccess: (saved) => {
                                            toast('Added a hidden page, ready to set up.');
                                            onOpen(saved.id);
                                        },
                                    })}
                                >
                                    Add a page under it
                                </Button>
                                {!isRoot && (
                                    <Button variant="secondary" icon={<Merge />} onClick={() => setMergeOpen(true)}>
                                        Merge with another page
                                    </Button>
                                )}
                                {!isRoot && (
                                    <Button
                                        variant="secondary"
                                        icon={<FolderTree />}
                                        disabled={page.offers.length === 0}
                                        title={page.offers.length === 0 ? 'It has no offers to sort.' : undefined}
                                        onClick={() => setResortOpen(true)}
                                    >
                                        Sort into sub pages
                                    </Button>
                                )}
                                {!isRoot && (
                                    <Button
                                        variant="danger"
                                        icon={<Trash2 />}
                                        disabled={remove.isPending || page.offers.length > 0}
                                        title={page.offers.length > 0 ? 'Move or delete its offers first.' : undefined}
                                        onClick={() => ask({ title: `Delete the page "${page.localization}"?`, confirm: 'Delete' }, () => remove.mutate([ page.id ], {
                                            onSuccess: () => {
                                                toast(`Deleted ${page.localization}.`);
                                                onOpen(page.parentId);
                                            },
                                        }))}
                                    >
                                        Delete page
                                    </Button>
                                )}
                                {!isRoot && page.offers.length > 0 && <p className="w-full text-xs text-muted">To delete the page, move or delete its offers first.</p>}
                            </div>
                            <p className="text-xs text-muted">A new page starts hidden, so it can be set up before anyone sees it. Drag a page in the tree to move it.</p>
                            {resortOpen && <ResortPageDialog tree={tree} pageId={page.id} onClose={() => setResortOpen(false)} />}
                            {mergeOpen && <MergePagesDialog tree={tree} pageIds={[ page.id ]} keepId={page.id} onClose={() => setMergeOpen(false)} onMerged={onOpen} />}
                        </Section>
                    )}
                </div>
                <div className="flex min-w-0 flex-col max-md:border-t max-md:border-line">

                    {spec.images.length > 0 && (
                        <Section title="Pictures">
                            {spec.images.map(slot => (
                                <ImageField
                                    key={slot.index}
                                    id={`slot-image-${slot.index}`}
                                    label={slot.label}
                                    hint={slot.hint}
                                    value={draft.imageData[slot.index] ?? ''}
                                    onChange={value => set('imageData', withSlot(draft.imageData, slot.index, value))}
                                    disabled={!canManage}
                                    highlight={highlight('image', slot.index)}
                                />
                            ))}
                        </Section>
                    )}

                    {spec.texts.length > 0 && (
                        <Section title="Words">
                            {spec.texts.map(slot => (
                                <div key={slot.index} className={cx('rounded-lg p-1 transition-colors', highlight('text', slot.index) && 'bg-accent-soft ring-2 ring-accent')}>
                                    <Labeled label={slot.label} hint={slot.hint}>
                                        {slot.long
                                            ? <Textarea id={`slot-text-${slot.index}`} value={draft.textData[slot.index] ?? ''} onChange={event => set('textData', withSlot(draft.textData, slot.index, event.target.value))} rows={3} maxLength={2000} disabled={!canManage} />
                                            : <Input id={`slot-text-${slot.index}`} value={draft.textData[slot.index] ?? ''} onChange={event => set('textData', withSlot(draft.textData, slot.index, event.target.value))} maxLength={2000} disabled={!canManage} />}
                                    </Labeled>
                                </div>
                            ))}
                            <p className="text-[11px] text-muted">The client reads simple HTML in these: &lt;b&gt;, &lt;i&gt;, &lt;br&gt; and &lt;a href&gt;.</p>
                        </Section>
                    )}

                    {(leftoverImages.length > 0 || leftoverTexts.length > 0) && (
                        <Section title="Not shown by this layout">
                            <p className="text-xs text-muted">The page keeps these from before, but this layout has nowhere to show them.</p>
                            <ul className="flex flex-col gap-1">
                                {[ ...leftoverImages.map(x => ({ ...x, list: 'imageData' as const })), ...leftoverTexts.map(x => ({ ...x, list: 'textData' as const })) ].map(x => (
                                    <li key={`${x.list}${x.index}`} className="flex items-center gap-2 rounded-lg bg-subtle px-2 py-1 text-xs">
                                        <span className="shrink-0 text-muted">{x.list === 'imageData' ? 'Picture' : 'Text'} {x.index + 1}</span>
                                        <span className="min-w-0 flex-1 truncate font-mono">{x.value}</span>
                                        {canManage && (
                                            <IconButton label="Clear it" icon={<X />} tone="bad" small onClick={() => set(x.list, withSlot(draft[x.list], x.index, ''))} />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </Section>
                    )}

                    {spec.images.length === 0 && spec.texts.length === 0 && <p className="px-4 py-4 text-sm text-muted">This layout takes no pictures or words.</p>}
                </div>
            </div>

            {(save.error ?? create.error ?? remove.error) && <div className="px-4 pb-4"><ErrorNotice error={save.error ?? create.error ?? remove.error} /></div>}

            {canManage && dirty && (
                <div className="sticky bottom-0 z-10 flex items-center gap-2 border-t border-accent/40 bg-surface/95 px-4 py-3 backdrop-blur">
                    <span className="mr-auto text-xs text-muted">Unsaved changes</span>
                    <Button variant="ghost" icon={<RotateCcw />} onClick={() => onDraft(pageDraftOf(page))} title="Put the fields back as saved">Reset</Button>
                    <Button type="submit" icon={<Save />} disabled={save.isPending}>Save page</Button>
                </div>
            )}

            <IconPicker value={draft.icon} open={iconOpen} onPick={icon => set('icon', icon)} onClose={() => setIconOpen(false)} />
            <LayoutPicker value={draft.layout} open={layoutOpen} extra={tree.layouts} onPick={layout => set('layout', layout)} onClose={() => setLayoutOpen(false)} />
        </form>
    );
};
