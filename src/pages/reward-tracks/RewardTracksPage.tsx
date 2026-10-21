import { ArrowDown, ArrowUp, CloudDownload, Gift, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { type RewardTrackListItem, useReloadRewardTracks, useReorderRewardTracks, useRewardTracks, useSetRewardTrackEnabled } from '#/api/rewardTracks';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Loading, PageBody, PageHeader, Panel, Switch, Td, Th } from '#/components/ui';
import { cx } from '#/lib/cx';

import { useMenuNames, useTrackNames } from './hooks';
import { ImportTracks } from './ImportTracks';
import { css, INTRODUCTION, MENU_ITEMS, menuTextKey, menuTracks, STATUS, statusOf, themeOf, utcText } from './model';
import { TrackEditor } from './TrackEditor';

const Schedule = ({ track }: { track: RewardTrackListItem }) => {
    const starts = utcText(track.startsAt);
    const ends = utcText(track.endsAt);

    if (!starts && !ends) return <span className="text-muted">No dates</span>;

    return (
        <span className="font-mono text-xs">
            {starts ?? 'now'} <span className="text-muted">→</span> {ends ?? 'no end'}
        </span>
    );
};

/**
 * The Progression menu as a player logging in now gets it: the layout's own items, Introduction
 * always among them, then an item per other live track in the tracks' order, each with the
 * Introduction item's gift icon and its own text.
 */
const MenuPreview = ({ tracks }: { tracks: RewardTrackListItem[] }) => {
    const shown = menuTracks(tracks);
    const names = useMenuNames([ INTRODUCTION, ...shown.map(x => x.id) ]);
    const item = (key: string, label: string, track = false) => (
        <li key={key} className={cx('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs', track ? 'border-accent/40 bg-accent-soft text-accent' : 'border-line text-muted')}>
            {track && <Gift className="size-3.5" />}
            {label}
        </li>
    );

    return (
        <Panel
            title="Progression menu"
            description="What players see under the toolbar's Progression icon, left to right. Introduction is always there and opens the introduction track. Every other live track gets its own item after it, in the order of the list below: use the arrows to move one. A changed order shows at each player's next login; a track turned on or off shows or goes at once. Each track's item shows how many of its prizes the player can claim, and the icon shows those of every track plus the daily tasks done."
        >
            <ol className="flex flex-wrap items-center gap-2 px-4 py-3">
                {MENU_ITEMS.map(x => item(x, x))}
                {item(INTRODUCTION, names.get(INTRODUCTION) ?? 'Introduction', true)}
                {shown.map(x => item(x.id, names.get(x.id) ?? menuTextKey(x.id), true))}
            </ol>
        </Panel>
    );
};

/** Every track, in the order players get them, with where each stands now. */
const TrackList = ({ tracks, onOpen }: { tracks: RewardTrackListItem[]; onOpen: (id: string) => void }) => {
    const names = useTrackNames(tracks.map(x => x.id));
    const menuNames = useMenuNames(tracks.map(x => x.id));
    const reorder = useReorderRewardTracks();
    const setEnabled = useSetRewardTrackEnabled();
    const move = (index: number, by: number) => {
        const ids = tracks.map(x => x.id);
        const [ moved ] = ids.splice(index, 1);

        ids.splice(index + by, 0, moved!);
        reorder.mutate(ids, { onSuccess: () => toast(`Moved ${moved}: players get the new order at their next login.`), onError: toastError });
    };

    if (tracks.length === 0) return <EmptyState>No reward tracks yet. Make one, or take Habbo's in from a capture.</EmptyState>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr>
                        <Th className="w-0">Order</Th>
                        <Th>Track</Th>
                        <Th>Menu item</Th>
                        <Th>Status</Th>
                        <Th className="w-0">On</Th>
                        <Th>Schedule (UTC)</Th>
                        <Th className="text-right">Tasks</Th>
                        <Th className="text-right">Prizes</Th>
                        <Th>Premium</Th>
                    </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                    {tracks.map((track, index) => {
                        const status = STATUS[statusOf(track)];

                        return (
                            <tr key={track.id} onClick={() => onOpen(track.id)} className="cursor-pointer hover:bg-subtle/60">
                                <Td>
                                    {/* The row's click opens the track: these keep theirs. */}
                                    <span className="flex gap-0.5" onClick={event => event.stopPropagation()}>
                                        <IconButton small label={`Move ${track.id} up`} icon={<ArrowUp />} disabled={index === 0 || reorder.isPending} onClick={() => move(index, -1)} />
                                        <IconButton small label={`Move ${track.id} down`} icon={<ArrowDown />} disabled={index === tracks.length - 1 || reorder.isPending} onClick={() => move(index, 1)} />
                                    </span>
                                </Td>
                                <Td>
                                    {/* A button for the keyboard: its click goes on to the row's. */}
                                    <button type="button" className="flex items-center gap-2.5 rounded text-left">
                                        <span className="size-4 shrink-0 rounded border border-black/10" style={{ background: css(themeOf(track.theme).dark) }} title={`Theme ${track.theme || 'blue'}`} />
                                        <span className="min-w-0">
                                            {names.has(track.id) && <span className="block truncate font-medium">{names.get(track.id)}</span>}
                                            <span className={cx('block font-mono', names.has(track.id) ? 'text-[11px] text-muted' : 'text-sm')}>{track.id}</span>
                                        </span>
                                    </button>
                                </Td>
                                <Td>
                                    <span className="block text-xs">{menuNames.get(track.id) ?? <span className="font-mono text-muted">{menuTextKey(track.id)}</span>}</span>
                                    {track.id === INTRODUCTION && <span className="block text-[11px] text-muted">Always in the menu</span>}
                                </Td>
                                <Td><span title={status.meaning}><Badge tone={status.tone}>{status.label}</Badge></span></Td>
                                <Td>
                                    <span onClick={event => event.stopPropagation()}>
                                        <Switch
                                            label={<span className="sr-only">{`${track.id} on`}</span>}
                                            checked={track.enabled}
                                            disabled={setEnabled.isPending}
                                            onChange={enabled => setEnabled.mutate({ id: track.id, enabled }, { onSuccess: () => toast(`${track.id} is ${enabled ? 'on' : 'off'}: sent to everyone online.`), onError: toastError })}
                                        />
                                    </span>
                                </Td>
                                <Td><Schedule track={track} /></Td>
                                <Td className="text-right font-mono text-xs tabular-nums">{track.tasks} <span className="text-muted">/ {track.levels} levels</span></Td>
                                <Td className="text-right font-mono text-xs tabular-nums">{track.prizes} <span className="text-muted">to {track.maxPoints.toLocaleString()} pts</span></Td>
                                <Td>{track.hasPremium ? <Badge tone="accent">Premium</Badge> : <span className="text-xs text-muted">None</span>}</Td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

/** Starting a new track: its id, which its texts are keyed by. */
const NewTrack = ({ taken, onMake }: { taken: string[]; onMake: (id: string) => void }) => {
    const [ id, setId ] = useState('');
    const clean = id.trim();
    const clash = taken.includes(clean);

    return (
        <form
            className="flex flex-wrap items-center gap-2 px-4 py-3"
            onSubmit={(event) => {
                event.preventDefault();
                if (clean && !clash) onMake(clean);
            }}
        >
            <Input value={id} onChange={event => setId(event.target.value)} placeholder="Track id, e.g. summer2027" aria-label="New track id" className="w-64 font-mono" maxLength={64} spellCheck={false} />
            <Button type="submit" icon={<Plus />} disabled={!clean || clash}>Make it</Button>
            <span className="text-xs text-muted">{clash ? 'A track has that id.' : 'Its texts are reward_track.<id>.name, .desc and .info, and its menu item widget.progmenu.rewardtrack.<id>; it starts off.'}</span>
        </form>
    );
};

/**
 * The reward tracks of the Progression menu: the list with where each stands (on, scheduled,
 * ended), a track's editor (settings, premium, tasks and their levels, prizes, and the prize strip
 * as the client draws it), and taking Habbo's tracks in from a capture of what its client was sent
 * at login, planned before anything changes. Every change is sent to the players online at once.
 */
export const RewardTracksPage = ({ importing = false }: { importing?: boolean }) => {
    const { id: trackId } = useParams();
    const navigate = useNavigate();
    const { data, error } = useRewardTracks();
    const reload = useReloadRewardTracks();
    const [ making, setMaking ] = useState(false);
    const open = (id: string) => void navigate(`/reward-tracks/${encodeURIComponent(id)}`);

    if (trackId && data)
        return <TrackEditor key={trackId} id={trackId} isNew={!data.tracks.some(x => x.id === trackId)} actionTypes={data.actionTypes} onBack={() => void navigate('/reward-tracks')} />;

    return (
        <>
            <PageHeader
                title="Reward tracks"
                description={importing ? 'Take Habbo\'s tracks in from a capture' : 'The Progression menu\'s tracks: tasks to do, points, prizes and premium'}
                back={importing ? { to: '/reward-tracks', label: 'Reward tracks' } : undefined}
            >
                {!importing && (
                    <>
                        <Button variant="secondary" icon={<RefreshCw />} disabled={reload.isPending} onClick={() => reload.mutate(undefined, { onSuccess: () => toast('Read the tracks again and sent them to everyone online.'), onError: toastError })}>
                            Reload
                        </Button>
                        <Button variant="secondary" icon={<CloudDownload />} onClick={() => void navigate('/reward-tracks/import')}>Import from Habbo</Button>
                        <Button icon={<Plus />} onClick={() => setMaking(x => !x)}>New track</Button>
                    </>
                )}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!data && !error && <Loading />}
                {data && importing && <ImportTracks onOpen={open} />}
                {data && !importing && (
                    <>
                        <MenuPreview tracks={data.tracks} />
                        <Panel title="Tracks" description="Players get the live ones at login, in this order. A change here is sent to everyone online at once. Open a track to change its tasks, prizes, dates and menu item text.">
                            {making && <NewTrack taken={data.tracks.map(x => x.id)} onMake={open} />}
                            <TrackList tracks={data.tracks} onOpen={open} />
                        </Panel>
                    </>
                )}
            </PageBody>
        </>
    );
};
