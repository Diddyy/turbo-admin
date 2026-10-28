import { useQueryClient } from '@tanstack/react-query';
import { Clock, CloudDownload, RotateCcw, Save, Zap } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router';

import type { VariableEntry } from '#/api/gamedata';
import { useHotelView, useSaveHotelView } from '#/api/hotelView';
import { ask } from '#/components/confirm';
import { Button, ErrorNotice, Input, Loading, PageBody, PageHeader, Segmented, SuccessNotice } from '#/components/ui';

import { AllTab } from './AllTab';
import { ArticlesTab } from './ArticlesTab';
import { BonusRareTab } from './BonusRareTab';
import { useHotelViewDraft } from './draft';
import { ExpiringPagesTab } from './ExpiringPagesTab';
import { GoalsTab } from './GoalsTab';
import { HabboPull } from './HabboPull';
import { backgroundCodes, BG_TIMING, fromLocalInput, nowAt, parsePart, parseSchedule, parseTime, promoCodes, type ReceptionPart, slotKey, SLOTS, toLocalInput } from './model';
import { PromosTab } from './PromosTab';
import { ReceptionTab } from './ReceptionTab';

/**
 * How a view's edits reach the server: kept with the page's other changes until Save (`draft`),
 * each sent as it is made (`now`), or some of each (`both`).
 */
type SaveModel = 'draft' | 'now' | 'both';

interface View {
    value: string;
    label: string;
    saves: SaveModel;
    /** Whether the view reads the preview time, and so shows its picker. */
    timed: boolean;
}

/** The page's tabs, each a group of views: at `/hotel-view/<group>/<view>`, or `/hotel-view/<group>` for a group of one. */
const GROUPS: { value: string; label: string; views: View[] }[] = [
    { value: 'reception', label: 'Reception', views: [ { value: 'reception', label: 'Reception', saves: 'draft', timed: true } ] },
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

/** The group and view a path asks for, each its first when not given or not known. */
const resolveView = (group: string | undefined, view: string | undefined) => {
    const found = GROUPS.find(x => x.value === group) ?? GROUPS[0]!;

    return { group: found, view: found.views.find(x => x.value === view) ?? found.views[0]! };
};

/** Where a view is: its group's path, and the view's own after it when the group holds more than one. */
const pathOf = (view: string) => {
    const group = GROUPS.find(x => x.views.some(v => v.value === view)) ?? GROUPS[0]!;

    return group.views.length > 1 ? `/hotel-view/${group.value}/${view}` : `/hotel-view/${group.value}`;
};

const SAVE_MODELS: Record<SaveModel, { icon: ReactNode; text: string }> = {
    draft: { icon: <Save />, text: 'Saved when you press Save, with every other change on this page' },
    now: { icon: <Zap />, text: 'Saves as you go: each item goes live when you save it. Putting its widget in a slot waits for Save' },
    both: { icon: <Zap />, text: 'Campaigns save as you go; the widget picture and its slot wait for Save' },
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

/** The editor, once the variables are in. */
const HotelViewEditor = ({ variables, canManage }: { variables: VariableEntry[]; canManage: boolean }) => {
    const [ params ] = useSearchParams();
    const { search } = useLocation();
    const navigate = useNavigate();
    const path = useParams();
    const { group, view } = resolveView(path.group, path.view);
    const part = parsePart(params.get('edit'));
    const promo = params.get('promo');
    const draft = useHotelViewDraft(variables);
    const save = useSaveHotelView();
    const queryClient = useQueryClient();
    const time = usePreviewTime();
    const { now } = time;
    const disabled = !canManage;
    // Where each group was last left - its view, and what was open there - so going back returns to it.
    const lastViews = useRef<Record<string, { view: string; search: string }>>({});
    const [ pulling, setPulling ] = useState(false);

    useEffect(() => {
        lastViews.current[group.value] = { view: view.value, search };
    }, [ group.value, view.value, search ]);

    const scheduledPromos = SLOTS.flatMap(slot => parseSchedule(draft.text(slotKey(slot, 'conf'))).map(x => x.code));
    const promos = promoCodes(draft.keys, scheduledPromos);
    const backgrounds = backgroundCodes(draft.keys, parseSchedule(draft.text(BG_TIMING)).map(x => x.code));

    const goView = (target: string, extra: Record<string, string> = {}) => void navigate({ pathname: pathOf(target), search: new URLSearchParams(extra).toString() }, { replace: true });
    const openPart = (target: ReceptionPart) => goView('reception', { edit: String(target) });
    const openSlot = (slot: number) => openPart(slot);
    const openGroup = (value: string) => {
        const last = lastViews.current[value];

        void navigate({ pathname: pathOf(last?.view ?? resolveView(value, undefined).view.value), search: last?.search ?? '' }, { replace: true });
    };

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
                    onChange: openGroup,
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
                        {save.data.changeSet ? <>Saved: {save.data.changeSet.summary}. Players see it when they next load the client. It can be rolled back from <Link to="/gamedata/updates/history" className="underline">the gamedata history</Link>.</> : 'Nothing had changed.'}
                    </SuccessNotice>
                )}
                {view.value === 'reception' && (
                    <ReceptionTab
                        draft={draft}
                        part={part}
                        onPart={openPart}
                        promoCodes={promos}
                        backgroundCodes={backgrounds}
                        now={now}
                        onOpenPromo={code => goView('promos', { promo: code })}
                        onOpenView={target => goView(target)}
                        disabled={disabled}
                    />
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
                {view.value === 'articles' && <ArticlesTab draft={draft} now={now} onOpenSlot={openSlot} disabled={disabled} />}
                {view.value === 'goals' && <GoalsTab draft={draft} now={now} onOpenSlot={openSlot} disabled={disabled} />}
                {view.value === 'bonus' && <BonusRareTab draft={draft} now={now} onOpenSlot={openSlot} disabled={disabled} />}
                {view.value === 'expiring' && <ExpiringPagesTab draft={draft} now={now} onOpenSlot={openSlot} disabled={disabled} />}
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
    const path = useParams();
    const { pathname, search } = useLocation();
    // With no group, or a group of several without its view, the path goes to the first of them.
    const canonical = pathOf(resolveView(path.group, path.view).view.value);

    if (pathname !== canonical)
        return <Navigate to={{ pathname: canonical, search }} replace />;

    if (!data)
        return (
            <>
                <PageHeader title="Hotel view" description="The reception players land in" />
                <PageBody>{error ? <ErrorNotice error={error} /> : <Loading />}</PageBody>
            </>
        );

    return <HotelViewEditor variables={data.variables} canManage={data.canManage} />;
};
