import { useMutation } from '@tanstack/react-query';
import { FileUp, Hammer, Layers, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { previewRewardTrackImport, type RewardTrackImportChange, type RewardTrackImportRequest, useImportRewardTracks } from '#/api/rewardTracks';
import { ask } from '#/components/confirm';
import { celebrate, toast, toastError } from '#/components/toast';
import { Badge, Button, Checkbox, ErrorNotice, Label } from '#/components/ui';

interface CaptureTrack {
    id?: unknown;
    tasks?: unknown[];
    prizes?: unknown[];
}

/**
 * The `RewardTracks` message in a file: the decoded message itself (`{ tracks: [...] }`), or a lab
 * file that holds it as `rewardTracks`.
 */
const captureOf = (json: unknown): { tracks: CaptureTrack[] } | null => {
    const has = (x: unknown): x is { tracks: CaptureTrack[] } => !!x && typeof x === 'object' && Array.isArray((x as { tracks?: unknown }).tracks);

    if (has(json)) return json;

    const inner = json && typeof json === 'object' ? (json as { rewardTracks?: unknown }).rewardTracks : null;

    return has(inner) ? inner : null;
};

const ACTIONS: Record<RewardTrackImportChange['action'], { label: string; tone: 'accent' | 'amber' | 'neutral' }> = {
    added: { label: 'add', tone: 'accent' },
    changed: { label: 'change', tone: 'amber' },
    unchanged: { label: 'same', tone: 'neutral' },
};

/** Ids added, changed and removed, as `+a ~b -c` lines. */
const IdChanges = ({ label, added, changed, removed }: { label: string; added: string[]; changed: string[]; removed: string[] }) => {
    if (added.length + changed.length + removed.length === 0) return <p className="text-xs text-muted">{label}: no change</p>;

    return (
        <div className="flex flex-col gap-1 text-xs">
            <span className="font-medium">{label}</span>
            {added.length > 0 && <p className="font-mono text-[11px] break-words text-good">+ {added.join(' ')}</p>}
            {changed.length > 0 && <p className="font-mono text-[11px] break-words text-warn">~ {changed.join(' ')}</p>}
            {removed.length > 0 && <p className="font-mono text-[11px] break-words text-bad">- {removed.join(' ')}</p>}
        </div>
    );
};

const TrackChange = ({ change, onOpen }: { change: RewardTrackImportChange; onOpen: (id: string) => void }) => {
    const action = ACTIONS[change.action];

    return (
        <li className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-2">
                <Badge tone={action.tone}>{action.label}</Badge>
                <button type="button" onClick={() => onOpen(change.id)} className="font-mono text-sm font-semibold hover:underline">{change.id}</button>
                {change.premiumChanged && <Badge tone="amber">premium changes</Badge>}
                {change.themeChanged && <Badge tone="amber">theme changes</Badge>}
            </div>
            {change.action !== 'unchanged' && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <IdChanges label="Tasks" added={change.tasksAdded} changed={change.tasksChanged} removed={change.tasksRemoved} />
                    <IdChanges label="Prizes" added={change.prizesAdded} changed={change.prizesChanged} removed={change.prizesRemoved} />
                </div>
            )}
            {change.warnings.length > 0 && (
                <details className="rounded-lg bg-warn-soft">
                    <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-xs text-warn">
                        <TriangleAlert className="size-3.5" />
                        {change.warnings.length} things this hotel cannot do of it
                    </summary>
                    <ul className="px-3 pb-2 font-mono text-[11px] leading-relaxed">{change.warnings.map(x => <li key={x}>{x}</li>)}</ul>
                </details>
            )}
        </li>
    );
};

/**
 * Taking Habbo's reward tracks in from a capture of what its client was sent at login (the
 * `RewardTracks` message). It is planned first - each track added, changed or the same, its tasks
 * and prizes added, changed and removed, and what this hotel cannot do of it - and nothing changes
 * until it is imported. A changed track keeps the hotel's own choices: on or off, its dates, and
 * the furni and name a kept prize gives.
 */
export const ImportTracks = ({ onOpen }: { onOpen: (id: string) => void }) => {
    const [ capture, setCapture ] = useState<{ name: string; json: { tracks: CaptureTrack[] } } | null>(null);
    const [ readError, setReadError ] = useState<string | null>(null);
    const [ skipped, setSkipped ] = useState<Set<string>>(new Set());
    const plan = useMutation({ mutationFn: previewRewardTrackImport });
    const run = useImportRewardTracks();
    const ids = (capture?.json.tracks ?? []).map(x => String(x.id ?? ''));
    const only = ids.filter(x => !skipped.has(x));

    const request = (): RewardTrackImportRequest => ({ capture: capture?.json ?? null, only: skipped.size > 0 ? only : null });

    const pick = async (file: File | undefined) => {
        plan.reset();
        setReadError(null);
        setCapture(null);
        setSkipped(new Set());

        if (!file) return;

        try {
            const json = captureOf(JSON.parse(await file.text()) as unknown);

            if (json) setCapture({ name: file.name, json });
            else setReadError(`${file.name} holds no RewardTracks message (a "tracks" list).`);
        } catch {
            setReadError(`${file.name} is not JSON.`);
        }
    };

    const toggle = (id: string, on: boolean) => {
        setSkipped((previous) => {
            const next = new Set(previous);

            if (on) next.delete(id);
            else next.add(id);

            return next;
        });
        plan.reset();
    };

    const apply = (button: HTMLElement) => {
        const changing = plan.data?.tracks.filter(x => x.action !== 'unchanged') ?? [];

        ask({
            title: `Import ${changing.length === 1 ? 'the track' : `${changing.length} tracks`}?`,
            body: `${changing.map(x => `${x.id} (${ACTIONS[x.action].label})`).join(', ')}, in one step. Everyone online is sent the tracks again at once.`,
            confirm: 'Import',
        }, () => {
            run.mutate(request(), {
                onSuccess: (result) => {
                    celebrate(button);
                    toast(result.saved ? `Imported ${result.tracks.filter(x => x.action !== 'unchanged').map(x => x.id).join(', ')}.` : 'Nothing to import: the tracks are in line with the capture.');
                    plan.mutate(request());
                },
                onError: toastError,
            });
        });
    };

    const data = plan.data;

    return (
        <div className="grid items-start gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 xl:sticky xl:top-4">
                <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><FileUp className="size-5" /></span>
                    <div>
                        <h2 className="text-sm font-semibold">Import from a Habbo capture</h2>
                        <p className="text-xs leading-relaxed text-muted">The RewardTracks message Habbo's client is sent at login, decoded: its tracks, tasks, levels, prizes and premium become the hotel's. You see what changes before anything is made.</p>
                    </div>
                </div>

                <section className="flex flex-col gap-1.5">
                    <Label as="h3">Capture</Label>
                    <input type="file" accept=".json,application/json" aria-label="Capture file" onChange={event => void pick(event.target.files?.[0])} className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-subtle file:px-3 file:py-1.5 file:text-xs" />
                    {capture && <span className="font-mono text-[11px] text-muted">{capture.name}</span>}
                    {readError && <span className="text-xs text-warn">{readError}</span>}
                </section>

                {capture && (
                    <section className="flex flex-col gap-2">
                        <Label as="h3">Tracks in it</Label>
                        {capture.json.tracks.map((track, index) => {
                            const id = String(track.id ?? '');

                            return (
                                <Checkbox
                                    key={`${id}-${index}`}
                                    label={<span className="font-mono">{id || '(no id)'}</span>}
                                    hint={`${track.tasks?.length ?? 0} tasks, ${track.prizes?.length ?? 0} prizes`}
                                    checked={!skipped.has(id)}
                                    onChange={on => toggle(id, on)}
                                />
                            );
                        })}
                    </section>
                )}

                {plan.error && <ErrorNotice error={plan.error} />}
                <Button icon={<Sparkles />} disabled={!capture || only.length === 0 || plan.isPending} onClick={() => plan.mutate(request())}>
                    {plan.isPending ? 'Planning…' : data ? 'Plan again' : 'Plan it'}
                </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
                {!data && (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-20 text-center text-muted">
                        <Layers className="size-9 text-accent" />
                        <p className="max-w-md text-sm">Pick a capture and plan it. Each track shows here with what happens to it, before anything is made.</p>
                    </div>
                )}
                {data && (
                    <>
                        <div className="grid grid-cols-3 gap-2">
                            {([ 'added', 'changed', 'unchanged' ] as const).map(action => (
                                <div key={action} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                                    <div className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{action === 'unchanged' ? 'the same' : action}</div>
                                    <div className="font-mono text-xl font-semibold tabular-nums">{data.tracks.filter(x => x.action === action).length}</div>
                                </div>
                            ))}
                        </div>
                        {!data.changes && <p className="text-xs text-muted">Nothing to do: the hotel's tracks are in line with the capture.</p>}
                        <ul className="flex flex-col gap-3">{data.tracks.map(x => <TrackChange key={x.id} change={x} onOpen={onOpen} />)}</ul>
                        {data.changes && (
                            <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-accent/50 bg-surface/95 p-3 shadow-xl backdrop-blur">
                                <span className="mr-auto text-xs text-muted">Live as soon as it is saved: everyone online is sent the tracks again.</span>
                                <Button icon={<Hammer />} disabled={run.isPending} onClick={event => apply(event.currentTarget)}>
                                    {run.isPending ? 'Importing…' : 'Import'}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
