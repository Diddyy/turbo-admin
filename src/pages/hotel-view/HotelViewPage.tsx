import { useQueryClient } from '@tanstack/react-query';
import { Clock, CloudDownload, Eye, RotateCcw, Save, Zap } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import type { VariableEntry } from '#/api/gamedata';
import { useHotelView, useSaveHotelView } from '#/api/hotelView';
import { ask } from '#/components/confirm';
import { Badge, Button, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel, Segmented, SuccessNotice } from '#/components/ui';

import { AllTab } from './AllTab';
import { ArticlesTab } from './ArticlesTab';
import { BackgroundsTab } from './BackgroundsTab';
import { BonusRareTab } from './BonusRareTab';
import { useHotelViewDraft } from './draft';
import { ExpiringPagesTab } from './ExpiringPagesTab';
import { GoalsTab } from './GoalsTab';
import { HabboPull } from './HabboPull';
import { slotShows } from './hooks';
import { LookTab } from './LookTab';
import { backgroundCodes, BG_TIMING, BOTTOM_SLOT, currentCode, fromLocalInput, nowAt, parseSchedule, parseTime, promoCodes, slotKey, SLOTS, toLocalInput, widgetLabel } from './model';
import { ReceptionPreview } from './Preview';
import { PromosTab } from './PromosTab';
import { SlotsTab } from './SlotsTab';

/**
 * How a view's edits reach the server: kept with the page's other changes until Save (`draft`),
 * each sent as it is made (`now`), or some of each (`both`). The preview edits nothing (`shows`).
 */
type SaveModel = 'draft' | 'now' | 'both' | 'shows';

interface View {
    value: string;
    label: string;
    saves: SaveModel;
    /** Whether the view reads the preview time, and so shows its picker. */
    timed: boolean;
}

/**
 * The page's tabs, each a group of views. A view's id is the tab id it had before the views were
 * grouped, so `?tab=<view>` still opens it; the page's own links say `?tab=<group>&view=<view>`.
 */
const GROUPS: { value: string; label: string; views: View[] }[] = [
    { value: 'preview', label: 'Preview', views: [ { value: 'preview', label: 'Preview', saves: 'shows', timed: true } ] },
    {
        value: 'layout',
        label: 'Layout',
        views: [
            { value: 'slots', label: 'Slots', saves: 'draft', timed: true },
            { value: 'backgrounds', label: 'Backgrounds', saves: 'draft', timed: true },
            { value: 'look', label: 'Look and widgets', saves: 'draft', timed: false },
        ],
    },
    {
        value: 'news',
        label: 'Promos and news',
        views: [
            { value: 'promos', label: 'Promos', saves: 'draft', timed: true },
            { value: 'articles', label: 'Articles', saves: 'now', timed: true },
        ],
    },
    {
        value: 'campaigns',
        label: 'Campaigns',
        views: [
            { value: 'goals', label: 'Community goals', saves: 'now', timed: true },
            { value: 'bonus', label: 'Bonus rare', saves: 'both', timed: true },
            { value: 'expiring', label: 'Expiring pages', saves: 'now', timed: true },
        ],
    },
    { value: 'advanced', label: 'Advanced', views: [ { value: 'all', label: 'All variables', saves: 'draft', timed: false } ] },
];

/** The group and view a link asks for: `?tab=<group>&view=<view>`, or a view's id alone as `?tab=`. */
const resolveView = (tab: string | null, view: string | null) => {
    const group = GROUPS.find(x => x.value === tab) ?? GROUPS.find(x => x.views.some(v => v.value === tab)) ?? GROUPS[0]!;
    const wanted = group.value === tab ? view : tab;

    return { group, view: group.views.find(x => x.value === wanted) ?? group.views[0]! };
};

/** Where to go for a view, with what else the link carries. */
const linkTo = (view: string, extra: Record<string, string> = {}) => ({ tab: resolveView(view, null).group.value, view, ...extra });

const SAVE_MODELS: Record<SaveModel, { icon: ReactNode; text: string }> = {
    draft: { icon: <Save />, text: 'Saved when you press Save, with every other change on this page' },
    now: { icon: <Zap />, text: 'Saves as you go: each item goes live when you save it' },
    both: { icon: <Zap />, text: 'Campaigns save as you go; the widget picture waits for Save' },
    shows: { icon: <Eye />, text: 'Shows your changes before they are saved' },
};

/** A line saying how the view's edits are saved. */
const SavesLine = ({ saves }: { saves: SaveModel }) => (
    <span className="flex items-center gap-1.5 text-xs text-muted [&_svg]:size-3.5 [&_svg]:shrink-0">
        {SAVE_MODELS[saves].icon}
        {SAVE_MODELS[saves].text}
    </span>
);

/** The time the preview and the schedules are shown at: now, following the clock, or one chosen. */
const usePreviewTime = () => {
    const [ chosen, setChosen ] = useState<number | null>(null);
    const [ clock, setClock ] = useState(() => Date.now());

    useEffect(() => {
        if (chosen !== null) return;

        const timer = window.setInterval(() => setClock(Date.now()), 30_000);

        return () => window.clearInterval(timer);
    }, [ chosen ]);

    return { now: chosen ?? clock, chosen, setChosen };
};

/** The picker for the preview time, in UTC. */
const TimePicker = ({ now, chosen, setChosen }: ReturnType<typeof usePreviewTime>) => (
    <div className="flex flex-wrap items-center gap-2 text-sm">
        <Clock className="size-4 shrink-0 text-muted" />
        <span className="text-muted">Showing the reception at</span>
        <span className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <Input
                type="datetime-local"
                value={toLocalInput(nowAt(now))}
                onChange={event => setChosen(parseTime(fromLocalInput(event.target.value)))}
                className="min-w-0 flex-1 sm:w-56 sm:flex-none"
                aria-label="Preview time (UTC)"
            />
            <span className="text-muted">UTC</span>
            {chosen !== null && <Button variant="ghost" onClick={() => setChosen(null)}>Now</Button>}
        </span>
    </div>
);

/** What the reception shows at the time: the backgrounds set, and each slot's widget or promo. */
const ShowingNow = ({ draft, now, onSlot }: { draft: ReturnType<typeof useHotelViewDraft>; now: number; onSlot: (slot: number) => void }) => {
    const background = currentCode(parseSchedule(draft.text(BG_TIMING)), now).code;

    return (
        <ul className="divide-y divide-line text-sm">
            <li className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="text-muted">Backgrounds</span>
                <span className="font-mono text-xs">{background || 'default'}</span>
            </li>
            {[ ...SLOTS, BOTTOM_SLOT ].map((slot) => {
                const shows = slotShows(draft, slot, now);
                const container = draft.text(slotKey(slot, 'widget')) === 'widgetcontainer';

                return (
                    <li key={slot}>
                        <button type="button" onClick={() => onSlot(slot)} className="flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left hover:bg-subtle">
                            <span className="text-muted">Slot {slot}</span>
                            <span className="flex min-w-0 items-center gap-2">
                                {container && shows.code && <span className="truncate font-mono text-xs">{shows.code}</span>}
                                {shows.type ? <Badge>{widgetLabel(shows.type)}</Badge> : <span className="text-xs text-muted">{container ? 'nothing scheduled' : 'empty'}</span>}
                            </span>
                        </button>
                    </li>
                );
            })}
        </ul>
    );
};

/** The editor, once the variables are in. */
const HotelViewEditor = ({ variables, canManage }: { variables: VariableEntry[]; canManage: boolean }) => {
    const [ params, setParams ] = useSearchParams();
    const { group, view } = resolveView(params.get('tab'), params.get('view'));
    const slotParam = Number(params.get('slot'));
    const focus = SLOTS.includes(slotParam as 1) || slotParam === BOTTOM_SLOT ? slotParam : null;
    const promo = params.get('promo');
    const draft = useHotelViewDraft(variables);
    const save = useSaveHotelView();
    const queryClient = useQueryClient();
    const time = usePreviewTime();
    const { now } = time;
    const disabled = !canManage;
    // The view each group was last left on, so going back to a group returns to it.
    const lastViews = useRef<Record<string, string>>({});
    const [ pulling, setPulling ] = useState(false);

    useEffect(() => {
        lastViews.current[group.value] = view.value;
    }, [ group.value, view.value ]);

    const scheduledPromos = SLOTS.flatMap(slot => parseSchedule(draft.text(slotKey(slot, 'conf'))).map(x => x.code));
    const promos = promoCodes(draft.keys, scheduledPromos);
    const backgrounds = backgroundCodes(draft.keys, parseSchedule(draft.text(BG_TIMING)).map(x => x.code));

    const go = (next: Record<string, string>) => setParams(next, { replace: true });
    const goView = (target: string, extra?: Record<string, string>) => go(linkTo(target, extra));
    const openSlot = (slot: number) => goView('slots', { slot: String(slot) });

    // Unsaved changes are lost with the page: say so before it closes. The draft lives here, above
    // every view, so this covers the changes made on any of them.
    useEffect(() => {
        if (draft.count === 0) return;

        const warn = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [ draft.count ]);

    return (
        <>
            <PageHeader
                title="Hotel view"
                description="The reception players land in: its backgrounds, widget slots and promos"
                tabs={{
                    items: GROUPS.map(x => ({ value: x.value, label: x.label })),
                    value: group.value,
                    onChange: value => goView(lastViews.current[value] ?? resolveView(value, null).view.value),
                }}
            >
                {canManage && <Button variant="secondary" icon={<CloudDownload />} onClick={() => setPulling(true)}>Pull from Habbo</Button>}
            </PageHeader>
            <HabboPull open={pulling} onClose={() => setPulling(false)} draft={draft} />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
                        {group.views.length > 1 && (
                            <div className="sm:w-md sm:max-w-full">
                                <Segmented label={group.label} value={view.value} onChange={value => goView(value)} options={group.views.map(x => ({ value: x.value, label: x.label }))} />
                            </div>
                        )}
                        <SavesLine saves={view.saves} />
                    </div>
                    {view.timed && <TimePicker {...time} />}
                </div>
                {save.isSuccess && draft.count === 0 && (
                    <SuccessNotice>
                        {save.data.changeSet ? <>Saved: {save.data.changeSet.summary}. Players see it when they next load the client. It can be rolled back from <Link to="/gamedata?tab=history" className="underline">the gamedata history</Link>.</> : 'Nothing had changed.'}
                    </SuccessNotice>
                )}
                {view.value === 'preview' && (
                    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
                        <Panel title="As a player sees it" description="On a 1600 by 900 window, scaled to fit. Click a slot to edit it. The avatar and the toolbar are left out.">
                            <div className="p-3">
                                <ReceptionPreview draft={draft} now={now} onSlot={openSlot} />
                            </div>
                        </Panel>
                        <Panel title="Showing">
                            <ShowingNow draft={draft} now={now} onSlot={openSlot} />
                        </Panel>
                    </div>
                )}
                {view.value === 'slots' && (
                    <>
                        <div className="sm:max-w-md">
                            <Segmented
                                label="Slot"
                                value={focus === null ? 'all' : String(focus)}
                                onChange={value => (value === 'all' ? goView('slots') : openSlot(Number(value)))}
                                options={[ { value: 'all', label: 'All' }, ...[ ...SLOTS, BOTTOM_SLOT ].map(x => ({ value: String(x), label: String(x) })) ]}
                            />
                        </div>
                        <SlotsTab draft={draft} codes={promos} now={now} focus={focus} onOpenPromo={code => goView('promos', { promo: code })} disabled={disabled} />
                    </>
                )}
                {view.value === 'promos' && (
                    <PromosTab
                        draft={draft}
                        codes={promos}
                        now={now}
                        open={promo}
                        onOpen={code => goView('promos', code ? { promo: code } : {})}
                        onOpenSlot={openSlot}
                        disabled={disabled}
                    />
                )}
                {view.value === 'articles' && <ArticlesTab now={now} disabled={disabled} />}
                {view.value === 'goals' && <GoalsTab now={now} disabled={disabled} />}
                {view.value === 'bonus' && <BonusRareTab draft={draft} now={now} disabled={disabled} />}
                {view.value === 'expiring' && <ExpiringPagesTab now={now} disabled={disabled} />}
                {view.value === 'backgrounds' && <BackgroundsTab draft={draft} codes={backgrounds} now={now} disabled={disabled} />}
                {view.value === 'look' && <LookTab draft={draft} disabled={disabled} />}
                {view.value === 'all' && <AllTab draft={draft} disabled={disabled} />}
                {/* Changes wait here on every view, those that save at once included, so none is forgotten. */}
                {canManage && (draft.count > 0 || save.isError) && (
                    <div className="sticky bottom-3 z-20 rounded-xl border border-accent/40 bg-surface/95 shadow-lg backdrop-blur">
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <span className="text-sm">
                                <span className="font-semibold">{draft.count}</span> {draft.count === 1 ? 'change' : 'changes'} not saved
                                <span className="text-muted max-sm:hidden"> · saved together, rolled back together</span>
                            </span>
                            {save.error && <div className="w-full sm:order-last"><ErrorNotice error={save.error} /></div>}
                            <span className="ml-auto flex gap-2">
                                <Button variant="ghost" icon={<RotateCcw />} disabled={save.isPending || draft.count === 0} onClick={() => ask({ title: 'Throw away every change not saved?', confirm: 'Discard' }, () => draft.discard())}>Discard</Button>
                                <Button
                                    icon={<Save />}
                                    disabled={save.isPending || draft.count === 0}
                                    onClick={() => save.mutate({ variables: draft.variables, texts: draft.texts }, {
                                        onSuccess: async () => {
                                            // What was saved is the server's now: read it, then let go of the changes.
                                            await queryClient.refetchQueries({ queryKey: [ 'gamedata', 'hotel-view' ] });
                                            draft.discard();
                                        },
                                    })}
                                >
                                    {save.isPending ? 'Saving' : 'Save'}
                                </Button>
                            </span>
                        </div>
                    </div>
                )}
            </PageBody>
        </>
    );
};

/**
 * The hotel view: the reception the client shows outside rooms. Everything on it is the client's
 * `landing.view.*` external variables - the background layers and their timed sets, the five widget
 * slots, the promos container slots schedule - and the external texts its promos say. Edits are
 * kept here until saved, then saved as one change set. The articles, community goals, bonus rare
 * campaigns and expiring pages are the server's own records, each saved at once.
 */
export const HotelViewPage = () => {
    const { data, error } = useHotelView();

    if (!data)
        return (
            <>
                <PageHeader title="Hotel view" description="The reception players land in" />
                <PageBody>{error ? <ErrorNotice error={error} /> : <Loading />}</PageBody>
            </>
        );

    return <HotelViewEditor variables={data.variables} canManage={data.canManage} />;
};
