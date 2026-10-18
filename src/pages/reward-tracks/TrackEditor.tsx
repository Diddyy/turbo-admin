import { RotateCcw, Save, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type RewardTrack, useDeleteRewardTrack, useRewardTrack, useSaveRewardTrack } from '#/api/rewardTracks';
import { ask } from '#/components/confirm';
import { celebrate, toast, toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';
import { inputToIso, isoToInput } from '#/pages/hotel-view/model';

import { GamePreview } from './GamePreview';
import { useGamePreviewUrl, useTrackNames } from './hooks';
import { blankTrack, css, problemsOf, STATUS, statusOf, THEME_NAMES, themeOf, trackPoints } from './model';
import { PrizesEditor } from './PrizesEditor';
import { StripPreview } from './StripPreview';
import { TasksEditor } from './TasksEditor';

const TABS = [
    { value: 'settings', label: 'Settings' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'prizes', label: 'Prizes' },
    { value: 'preview', label: 'Preview' },
];

/** Whole numbers from an input, not below a floor. */
const whole = (text: string, min = 0) => Math.max(min, Math.floor(Number(text) || 0));

/** On or off, the dates, the theme and premium. */
const SettingsTab = ({ track, onChange }: { track: RewardTrack; onChange: (track: RewardTrack) => void }) => {
    const set = <K extends keyof RewardTrack>(key: K, value: RewardTrack[K]) => onChange({ ...track, [key]: value });
    const premium = track.premium;
    const status = STATUS[statusOf(track)];

    return (
        <div className="grid items-start gap-4 xl:grid-cols-2">
            <Panel title="When players get it" description="The protocol has no dates: a track is sent at login while it is on and within its dates, and counts nothing once it has ended.">
                <div className="flex flex-col gap-4 p-4">
                    <Switch label="On" hint="Off, it is sent to nobody and nothing counts for it." checked={track.enabled} onChange={value => set('enabled', value)} />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Labeled label="Starts (UTC)" hint="Empty: from now.">
                            <Input type="datetime-local" value={isoToInput(track.startsAt)} onChange={event => set('startsAt', inputToIso(event.target.value))} aria-label="Starts (UTC)" />
                        </Labeled>
                        <Labeled label="Ends (UTC)" hint="Empty: no end.">
                            <Input type="datetime-local" value={isoToInput(track.endsAt)} onChange={event => set('endsAt', inputToIso(event.target.value))} aria-label="Ends (UTC)" />
                        </Labeled>
                    </div>
                    <p className="flex items-center gap-2 text-xs text-muted"><Badge tone={status.tone}>{status.label}</Badge>{status.meaning}</p>
                </div>
            </Panel>
            <Panel title="Theme" description="The window's colours (RewardTrackTheme); a name the client does not know draws as blue.">
                <div className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap gap-2">
                        {THEME_NAMES.map((name) => {
                            const theme = themeOf(name);

                            return (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => set('theme', name)}
                                    aria-pressed={track.theme === name}
                                    className={cx('flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs', track.theme === name ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-subtle')}
                                >
                                    <span className="flex overflow-hidden rounded border border-black/10">
                                        {[ theme.dark, theme.medium, theme.light, theme.active ].map(color => <span key={color} className="size-4" style={{ background: css(color) }} />)}
                                    </span>
                                    {name}
                                </button>
                            );
                        })}
                    </div>
                    <Labeled label="Theme name" hint="As the client is sent it.">
                        <Input value={track.theme} onChange={event => set('theme', event.target.value.trim())} className="w-56 font-mono" aria-label="Theme name" />
                    </Labeled>
                </div>
            </Panel>
            <Panel title="Premium" description="Bought from the track's window; its levels and prizes need it, and its owner's task points are multiplied by the boost." className="xl:col-span-2">
                <div className="flex flex-col gap-4 p-4">
                    <Switch
                        label="Sold on this track"
                        checked={!!premium}
                        onChange={value => set('premium', value ? { taskPointsBoost: 1.2, instantPoints: 0, costCredits: 0, costDiamonds: 0 } : null)}
                    />
                    {premium && (
                        <div className="grid gap-3 sm:grid-cols-4">
                            <Labeled label="Points boost" hint={`"${Math.round((premium.taskPointsBoost - 1) * 100)}% faster progression"`}>
                                <Input type="number" min={1} step={0.05} value={premium.taskPointsBoost} onChange={event => set('premium', { ...premium, taskPointsBoost: Math.max(1, Number(event.target.value) || 1) })} className="font-mono" aria-label="Points boost" />
                            </Labeled>
                            <Labeled label="Points at once" hint="Given when bought.">
                                <Input type="number" min={0} value={premium.instantPoints} onChange={event => set('premium', { ...premium, instantPoints: whole(event.target.value) })} className="font-mono" aria-label="Points at once" />
                            </Labeled>
                            <Labeled label="Credits">
                                <Input type="number" min={0} value={premium.costCredits} onChange={event => set('premium', { ...premium, costCredits: whole(event.target.value) })} className="font-mono" aria-label="Cost in credits" />
                            </Labeled>
                            <Labeled label="Diamonds">
                                <Input type="number" min={0} value={premium.costDiamonds} onChange={event => set('premium', { ...premium, costDiamonds: whole(event.target.value) })} className="font-mono" aria-label="Cost in diamonds" />
                            </Labeled>
                        </div>
                    )}
                </div>
            </Panel>
        </div>
    );
};

/**
 * One track's editor. Changes stay here until saved; a save replaces the track whole and sends the
 * tracks again to everyone online (the client rebuilds the window and says "Reward Track updated").
 */
export const TrackEditor = ({ id, isNew, actionTypes, onBack }: { id: string; isNew: boolean; actionTypes: string[]; onBack: () => void }) => {
    const [ params, setParams ] = useSearchParams();
    const tab = TABS.find(x => x.value === params.get('tab'))?.value ?? 'settings';
    const { data, error } = useRewardTrack(isNew ? null : id);
    const save = useSaveRewardTrack();
    const remove = useDeleteRewardTrack();
    const saved = useMemo(() => data?.track ?? (isNew ? blankTrack(id) : null), [ data, isNew, id ]);
    const [ draft, setDraft ] = useState<RewardTrack | null>(null);
    // Furni picked here, before the server names them back.
    const [ picked, setPicked ] = useState<Map<string, string>>(new Map());
    const names = useTrackNames([ id ]);
    const gamePreview = useGamePreviewUrl();
    const track = draft ?? saved;
    const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
    const furni = useMemo(() => new Map([ ...(data?.furni ?? []).map(x => [ x.prizeId, x.name ] as const), ...picked ]), [ data, picked ]);

    useEffect(() => {
        if (!dirty) return;

        const warn = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [ dirty ]);

    const header = (
        <PageHeader
            title={names.get(id) ?? id}
            description={isNew ? 'A new track: nothing is made until you save it' : <span className="font-mono">{id}</span>}
            back={{ to: '/reward-tracks', label: 'Reward tracks' }}
            tabs={{ items: TABS, value: tab, onChange: value => setParams({ track: id, tab: value }, { replace: true }) }}
        >
            {!isNew && (
                <Button
                    variant="danger"
                    icon={<Trash2 />}
                    disabled={remove.isPending}
                    onClick={() => ask({ title: `Delete the track ${id}?`, body: 'It goes from everyone online at once. Players\' progress in it is kept, so it comes back if a track of this id is made again.', confirm: 'Delete' }, () => {
                        remove.mutate(id, {
                            onSuccess: () => {
                                toast(`Deleted ${id}.`);
                                onBack();
                            },
                            onError: toastError,
                        });
                    })}
                >
                    Delete
                </Button>
            )}
        </PageHeader>
    );

    if (!track)
        return <>{header}<PageBody>{error ? <ErrorNotice error={error} /> : <Loading />}</PageBody></>;

    const problems = problemsOf(track);
    const change = (next: RewardTrack) => setDraft(next);

    return (
        <>
            {header}
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <Badge tone={STATUS[statusOf(track)].tone}>{STATUS[statusOf(track)].label}</Badge>
                    <span>{track.tasks.length} tasks · {track.tasks.reduce((sum, x) => sum + x.levels.length, 0)} levels · {trackPoints(track).toLocaleString()} points to earn · {track.prizes.length} prizes</span>
                </div>
                {data && data.warnings.length > 0 && (
                    <details className="rounded-xl border border-warn-line bg-warn-soft">
                        <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-warn">
                            <TriangleAlert className="size-4" />
                            {data.warnings.length} things this hotel cannot do of the saved track
                        </summary>
                        <ul className="px-4 pb-3 font-mono text-[11px] leading-relaxed">
                            {data.warnings.map(x => <li key={x}>{x}</li>)}
                        </ul>
                    </details>
                )}
                {tab === 'settings' && <SettingsTab track={track} onChange={change} />}
                {tab === 'tasks' && <TasksEditor track={track} actionTypes={actionTypes} onChange={change} />}
                {tab === 'prizes' && <PrizesEditor track={track} furni={furni} onPickFurni={(prize, name) => setPicked(previous => new Map(previous).set(prize, name))} onChange={change} />}
                {tab === 'preview' && gamePreview && (
                    <Panel title="As a player sees it" description="The track's window, drawn by the game client itself for a player with these points and nothing claimed yet. Unsaved changes show here too.">
                        <div className="p-4"><GamePreview track={track} url={gamePreview} /></div>
                    </Panel>
                )}
                {tab === 'preview' && !gamePreview && (
                    <Panel title="As a player sees it" description="The prize strip of the track's window, for a player with no points yet: the client's own positions and pages. Unsaved changes show here too. Set Turbo:Admin:ClientPreviewUrl (or ClientLoginUrl) to see the game's own window here.">
                        <div className="p-4"><StripPreview track={track} furni={furni} title={names.get(id) ?? null} /></div>
                    </Panel>
                )}
                {(dirty || isNew || save.isError) && (
                    <div className="sticky bottom-3 z-20 rounded-xl border border-accent/40 bg-surface/95 shadow-lg backdrop-blur">
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <span className="text-sm">{isNew ? 'A new track, not saved' : 'Changes not saved'}<span className="text-muted max-sm:hidden"> · sent to everyone online when saved</span></span>
                            {problems.length > 0 && <ul className="w-full text-xs text-warn sm:order-last">{problems.map(x => <li key={x}>{x}</li>)}</ul>}
                            {save.error && <div className="w-full sm:order-last"><ErrorNotice error={save.error} /></div>}
                            <span className="ml-auto flex gap-2">
                                {!isNew && <Button variant="ghost" icon={<RotateCcw />} disabled={save.isPending || !dirty} onClick={() => ask({ title: 'Throw away every change not saved?', confirm: 'Discard' }, () => setDraft(null))}>Discard</Button>}
                                <Button
                                    icon={<Save />}
                                    disabled={save.isPending || problems.length > 0 || (!dirty && !isNew)}
                                    onClick={(event) => {
                                        const button = event.currentTarget;

                                        save.mutate(track, {
                                            onSuccess: () => {
                                                celebrate(button);
                                                setDraft(null);
                                                setPicked(new Map());
                                                toast(`Saved ${id}: sent to everyone online.`);
                                            },
                                        });
                                    }}
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
