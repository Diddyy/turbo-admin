import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Check, Coins, Hammer, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { type BuildPlan, type BuildRequest, catalogCalls, type CatalogPageDetail, type CatalogTree, type PageDisplay, useCatalogEdit, useFurniLines } from '#/api/catalog';
import { Modal } from '#/components/Modal';
import { toast } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Segmented, Select, Switch, TextButton, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';

import { buildersFor, type BuilderSpec } from './builders';
import { PageSelect } from './fields';
import { IconPicker } from './IconPicker';
import { DISPLAY_LABELS } from './labels';
import { layoutOf } from './layouts';
import { PageIcon } from './PageTree';
import { ProductIcon } from './ProductIcon';

const blankRequest = (spec: BuilderSpec): BuildRequest => ({ builder: spec.kind, base: null, line: null, prefix: null, petType: null });

/** What a builder is told: a colour family, a furni line or prefix, or a pet type. */
const BuilderInputs = ({ spec, request, onChange }: { spec: BuilderSpec; request: BuildRequest; onChange: (request: BuildRequest) => void }) => {
    const lines = useFurniLines(spec.input === 'line');
    const [ byPrefix, setByPrefix ] = useState(false);

    switch (spec.input) {
        case 'base':
            return (
                <Labeled label="Colour family" hint="The class name before the *: chair_plasty makes chair_plasty*1, *2 and on.">
                    <Input value={request.base ?? ''} onChange={event => onChange({ ...request, base: event.target.value.trim().replace(/\*.*$/, '') || null })} placeholder="chair_plasty" spellCheck={false} className="w-full font-mono" autoFocus />
                </Labeled>
            );
        case 'line':
            return (
                <div className="flex flex-col gap-2">
                    <div className="self-start">
                        <Segmented
                            label="Pick the furni"
                            value={byPrefix ? 'prefix' : 'line'}
                            onChange={value => setByPrefix(value === 'prefix')}
                            options={[ { value: 'line', label: 'By furni line' }, { value: 'prefix', label: 'By class name prefix' } ]}
                        />
                    </div>
                    {byPrefix
                        ? <Input value={request.prefix ?? ''} onChange={event => onChange({ ...request, line: null, prefix: event.target.value.trim() || null })} placeholder="e.g. hween_c23_" spellCheck={false} className="w-full font-mono" aria-label="Class name prefix" />
                        : (
                                <Select value={request.line ?? ''} onChange={event => onChange({ ...request, prefix: null, line: event.target.value || null })} aria-label="Furni line" disabled={!lines.data}>
                                    <option value="">{lines.isPending ? 'Loading lines…' : 'Pick a furni line…'}</option>
                                    {lines.data?.lines.map(x => <option key={x.line} value={x.line}>{x.line} ({x.count})</option>)}
                                </Select>
                            )}
                </div>
            );
        case 'petType':
            return (
                <Labeled label="Pet type" hint="Empty: accessories for every pet. 15 is the horse.">
                    <Input type="number" min={0} value={request.petType ?? ''} onChange={event => onChange({ ...request, petType: event.target.value === '' ? null : Math.max(0, Math.floor(Number(event.target.value))) })} placeholder="all" className="w-28 font-mono" />
                </Labeled>
            );
        default:
            return null;
    }
};

/** Whether the request has what its builder needs. */
const ready = (spec: BuilderSpec, request: BuildRequest) =>
    spec.input === 'base' ? !!request.base : spec.input === 'line' ? !!request.line || (request.prefix?.length ?? 0) >= 3 : true;

interface PageBuilderProps {
    tree: CatalogTree;
    /** The page open in the editor, to build onto; null builds onto a new page only. */
    page: CatalogPageDetail | null;
    open: boolean;
    onClose: () => void;
    /** Built onto a new page: its id, to open it. */
    onBuiltPage: (id: number) => void;
}

/** Where the build goes: onto the open page, or onto a new page made for it. */
type Target = 'this' | 'new';

/**
 * Building a page the way its layout wants it, from the hotel's own data: pick a builder (those
 * made for this page's layout first), tell it what it needs, look over what it plans - each item,
 * what it gives, and whether the catalog already sells it - pick from it, price it, and build. The
 * server plans again and makes only what was picked, through the usual checks; what it refuses is
 * listed.
 */
export const PageBuilder = ({ tree, page, open, onClose, onBuiltPage }: PageBuilderProps) => {
    const [ target, setTarget ] = useState<Target>(page ? 'this' : 'new');
    // A new page goes beside the open one, else among the tabs' first.
    const [ parentId, setParentId ] = useState<number | null>(() => page?.parentId ?? (tree.pages.find(x => x.parentId === tree.rootId)?.id ?? tree.rootId));
    const [ newTitle, setNewTitle ] = useState('');
    const [ titleTouched, setTitleTouched ] = useState(false);
    const [ newIcon, setNewIcon ] = useState<number | null>(null);
    const [ iconOpen, setIconOpen ] = useState(false);
    const onPage = target === 'this' && page ? page : null;
    const layout = onPage?.layout ?? '';
    const buildOn = onPage?.id ?? parentId;
    const parentTitle = tree.pages.find(x => x.id === parentId)?.localization ?? 'the top level';
    const specs = useMemo(() => buildersFor(layout), [ layout ]);
    const [ spec, setSpec ] = useState<BuilderSpec | null>(null);
    const [ request, setRequest ] = useState<BuildRequest | null>(null);
    const [ picked, setPicked ] = useState<Set<string>>(() => new Set());
    const [ price, setPrice ] = useState({ costCredits: 3, costCurrency: 0, currencyTypeId: null as number | null, clubLevel: 0, canGift: true, visible: true, setLayout: true, display: 'invisible' as PageDisplay });
    const plan = useMutation({ mutationFn: (args: BuildRequest) => catalogCalls.previewBuild(buildOn!, args) });
    const build = useCatalogEdit(catalogCalls.applyBuild);
    const data: BuildPlan | undefined = plan.data;

    const reset = () => {
        setSpec(null);
        setRequest(null);
        plan.reset();
        build.reset();
    };

    const close = () => {
        reset();
        onClose();
    };

    const typeTitle = (value: string) => {
        setNewTitle(value);
        setTitleTouched(true);
    };

    const choose = (next: BuilderSpec) => {
        const fresh = blankRequest(next);

        if (target === 'new' && !titleTouched)
            setNewTitle(next.title);

        setSpec(next);
        setRequest(fresh);
        build.reset();

        if (next.input === 'none')
            plan.mutate(fresh, { onSuccess: result => setPicked(new Set(result.items.filter(x => !x.alreadyOffered).map(x => x.key))) });
        else
            plan.reset();
    };

    const runPlan = () => request && plan.mutate(request, { onSuccess: result => setPicked(new Set(result.items.filter(x => !x.alreadyOffered).map(x => x.key))) });

    const toggle = (key: string) => setPicked((current) => {
        const next = new Set(current);

        if (!next.delete(key))
            next.add(key);

        return next;
    });

    const apply = () => {
        if (!request || !data)
            return;

        if (!buildOn || (!onPage && !newTitle.trim()))
            return;

        build.mutate([ buildOn, {
            ...request,
            keys: data.items.filter(x => picked.has(x.key)).map(x => x.key),
            ...price,
            setLayout: !!onPage && price.setLayout && !data.createsPages && data.layout !== onPage.layout,
            display: data.createsPages || !onPage ? price.display : null,
            newPageTitle: onPage ? null : newTitle.trim(),
            newPageIcon: onPage ? null : newIcon,
        } ], {
            onSuccess: (result) => {
                const parts = [
                    result.pagesCreated && `${result.pagesCreated} page${result.pagesCreated === 1 ? '' : 's'}`,
                    result.offersCreated && `${result.offersCreated} offer${result.offersCreated === 1 ? '' : 's'}`,
                    result.offersMoved && `${result.offersMoved} moved`,
                ].filter(Boolean);

                toast(`Built ${parts.join(', ') || 'nothing'}. Publish to put it live.`);

                if (!onPage && result.pageId)
                    onBuiltPage(result.pageId);

                if (result.failures.length === 0)
                    close();
            },
        });
    };

    const moving = data?.builder === 'soldLimited';
    const changesLayout = onPage && data && !data.createsPages && data.layout !== onPage.layout;

    return (
        <Modal title={spec ? <span className="flex items-center gap-2"><IconButton label="Back to the builders" icon={<ArrowLeft />} small onClick={reset} />Build: {spec.title}</span> : 'Build'} open={open} onClose={close} className="sm:max-w-3xl">
            {!spec && (
                <div className="flex flex-col gap-3 p-4">
                    <div className="flex flex-col gap-3 rounded-xl border border-line bg-subtle/40 p-3">
                        <Segmented
                            label="Build onto"
                            value={target}
                            onChange={(value) => {
                                setTarget(value as Target);
                                plan.reset();
                            }}
                            options={[
                                ...(page ? [ { value: 'this', label: `This page: ${page.localization}` } ] : []),
                                { value: 'new', label: 'A new page' },
                            ]}
                        />
                        {target === 'new' && (
                            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
                                <Labeled label="Icon">
                                    <button type="button" onClick={() => setIconOpen(true)} title="Pick its icon" className="grid size-10 place-items-center rounded-lg border border-line bg-canvas hover:border-accent sm:size-8">
                                        {newIcon ? <PageIcon icon={newIcon} /> : <span className="text-[10px] text-muted">icon</span>}
                                    </button>
                                </Labeled>
                                <Labeled label="Title" hint="The builder's name until you type one.">
                                    <Input value={newTitle} maxLength={50} onChange={event => typeTitle(event.target.value)} placeholder="New page" />
                                </Labeled>
                                <Labeled label="Under">
                                    <PageSelect tree={tree} value={parentId} onChange={setParentId} placeholder="The top level (a tab)" />
                                </Labeled>
                                <Labeled label="Shown in" className="sm:col-span-3">
                                    <Select value={price.display} onChange={event => setPrice({ ...price, display: event.target.value as PageDisplay })}>
                                        {([ 'invisible', 'regular', 'both', 'bc_only' ] as PageDisplay[]).map(x => <option key={x} value={x}>{DISPLAY_LABELS[x]}</option>)}
                                    </Select>
                                </Labeled>
                            </div>
                        )}
                    </div>
                    <p className="text-sm text-muted">
                        {onPage
                            ? <>Fill <span className="font-medium text-ink">{onPage.localization}</span> ({layoutOf(onPage.layout).title}) from the hotel's own furniture, pets and effects, the way its layout reads them.</>
                            : <>Make a page under <span className="font-medium text-ink">{parentTitle}</span> with the builder's layout, filled from the hotel's own furniture, pets and effects.</>}
                        {' '}You look over everything before it's made.
                    </p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {specs.map(x => (
                            <li key={x.kind}>
                                <button
                                    type="button"
                                    onClick={() => choose(x)}
                                    className="flex h-full w-full flex-col gap-1.5 rounded-xl border border-line bg-canvas p-3 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
                                >
                                    <span className="flex items-center gap-2">
                                        <Wand2 className="size-4 text-accent" />
                                        <span className="flex-1 text-sm font-semibold">{x.title}</span>
                                        {onPage && x.layouts.includes(onPage.layout) && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">for this layout</span>}
                                    </span>
                                    <span className="text-xs leading-snug text-muted">{x.blurb}</span>
                                    <span className="mt-auto pt-1 font-mono text-[11px] text-muted">{x.layouts[0]}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {spec && request && (
                <div className="flex flex-col gap-4 p-4">
                    {spec.input !== 'none' && (
                        <form
                            onSubmit={(event) => {
                                event.preventDefault();
                                runPlan();
                            }}
                            className="flex flex-col gap-2"
                        >
                            <BuilderInputs spec={spec} request={request} onChange={setRequest} />
                            <Button type="submit" variant="secondary" icon={<Wand2 />} disabled={!ready(spec, request) || plan.isPending} className="self-start">Plan it</Button>
                        </form>
                    )}

                    {plan.isPending && <p className="text-sm text-muted">Planning…</p>}
                    {plan.error && <ErrorNotice error={plan.error} />}

                    {data && (
                        <>
                            {data.warnings.map(x => <WarningNotice key={x}>{x}</WarningNotice>)}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-medium">{picked.size} of {data.items.length} picked</span>
                                <span className="text-muted">·</span>
                                <TextButton onClick={() => setPicked(new Set(data.items.map(x => x.key)))}>all</TextButton>
                                <TextButton onClick={() => setPicked(new Set(data.items.filter(x => !x.alreadyOffered).map(x => x.key)))}>only new</TextButton>
                                <TextButton onClick={() => setPicked(new Set())}>none</TextButton>
                            </div>
                            {data.items.length === 0
                                ? <EmptyState>Nothing to build from that.</EmptyState>
                                : (
                                        <ul className="max-h-[40dvh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
                                            {data.items.map((item) => {
                                                const first = item.products[0];

                                                return (
                                                    <li key={item.key}>
                                                        <label className={cx('flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-subtle', !picked.has(item.key) && 'opacity-60')}>
                                                            <input type="checkbox" checked={picked.has(item.key)} onChange={() => toggle(item.key)} className="size-4 accent-accent" />
                                                            {first && <ProductIcon type={first.type} name={first.definitionName ?? first.extraParam} className="size-8" />}
                                                            <span className="min-w-0 flex-1">
                                                                <span className="block truncate text-sm">{item.pageTitle ?? item.title}</span>
                                                                <span className="block truncate font-mono text-[11px] text-muted">
                                                                    {item.localizationId}
                                                                    {item.products.length > 1 && ` · ${item.products.length} things`}
                                                                    {first?.definitionName && first.definitionName !== item.localizationId && ` · ${first.definitionName}`}
                                                                </span>
                                                            </span>
                                                            {item.note && <span className="shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[11px] text-muted">{item.note}</span>}
                                                            {item.alreadyOffered && <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] text-warn">already sold</span>}
                                                        </label>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}

                            {!moving && data.items.length > 0 && (
                                <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
                                    <Labeled label="Each costs">
                                        <div className="flex gap-2">
                                            <div className="relative w-28">
                                                <Coins className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-coin" />
                                                <Input type="number" min={0} value={price.costCredits} onChange={event => setPrice({ ...price, costCredits: Math.max(0, Number(event.target.value) || 0) })} className="w-full pl-8 font-mono" aria-label="Credits" />
                                            </div>
                                            <Input type="number" min={0} value={price.costCurrency} onChange={event => setPrice({ ...price, costCurrency: Math.max(0, Number(event.target.value) || 0) })} disabled={tree.currencies.length === 0} className="w-20 font-mono" aria-label="Currency amount" />
                                            <Select value={price.currencyTypeId ?? ''} onChange={event => setPrice({ ...price, currencyTypeId: event.target.value ? Number(event.target.value) : null })} disabled={tree.currencies.length === 0} aria-label="Currency" className="min-w-0 flex-1">
                                                <option value="">no currency</option>
                                                {tree.currencies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                                            </Select>
                                        </div>
                                    </Labeled>
                                    <Labeled label="Who may buy">
                                        <Select value={price.clubLevel} onChange={event => setPrice({ ...price, clubLevel: Number(event.target.value) })}>
                                            <option value={0}>Anyone</option>
                                            <option value={1}>Club</option>
                                            <option value={2}>VIP</option>
                                        </Select>
                                    </Labeled>
                                    <Switch label="Can be gifted" checked={price.canGift} onChange={value => setPrice({ ...price, canGift: value })} />
                                    <Switch label="Shown" checked={price.visible} onChange={value => setPrice({ ...price, visible: value })} />
                                    {changesLayout && (
                                        <Switch
                                            label={`Make this page ${layoutOf(data.layout).title}`}
                                            hint={`Its layout is ${onPage.layout}; what this builds is read by ${data.layout}.`}
                                            checked={price.setLayout}
                                            onChange={value => setPrice({ ...price, setLayout: value })}
                                            className="sm:col-span-2"
                                        />
                                    )}
                                    {data.createsPages && onPage && (
                                        <Labeled label="The new pages are shown in" hint="Hidden lets you look them over before players do.">
                                            <Select value={price.display} onChange={event => setPrice({ ...price, display: event.target.value as PageDisplay })}>
                                                {([ 'invisible', 'regular', 'both', 'bc_only' ] as PageDisplay[]).map(x => <option key={x} value={x}>{DISPLAY_LABELS[x]}</option>)}
                                            </Select>
                                        </Labeled>
                                    )}
                                </div>
                            )}

                            {build.error && <ErrorNotice error={build.error} />}
                            {build.data && build.data.failures.length > 0 && (
                                <WarningNotice>
                                    <span className="flex flex-col gap-1">
                                        <span>{build.data.failures.length} couldn't be made:</span>
                                        {build.data.failures.slice(0, 8).map(x => <span key={x.key} className="text-xs"><span className="font-mono">{data.items.find(i => i.key === x.key)?.localizationId ?? x.key}</span>: {x.error}</span>)}
                                    </span>
                                </WarningNotice>
                            )}

                            {tree.canManage && (
                                <div className="flex items-center gap-2">
                                    <span className="mr-auto text-xs text-muted">
                                        {data.createsPages
                                            ? `${picked.size} new page${picked.size === 1 ? '' : 's'} under ${onPage?.localization ?? newTitle.trim()}, each with its offer.`
                                            : moving
                                                ? `${picked.size} offer${picked.size === 1 ? '' : 's'} move here.`
                                                : `${picked.size} new offer${picked.size === 1 ? '' : 's'} on ${onPage ? onPage.localization : `a new page, ${newTitle.trim() || '…'}, under ${parentTitle}`}.`}
                                    </span>
                                    <Button icon={build.isSuccess && build.data.failures.length === 0 ? <Check /> : <Hammer />} disabled={picked.size === 0 || build.isPending} onClick={apply}>
                                        {build.isPending ? 'Building…' : 'Build'}
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
            <IconPicker value={newIcon ?? 0} open={iconOpen} onPick={setNewIcon} onClose={() => setIconOpen(false)} />
        </Modal>
    );
};
