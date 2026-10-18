import { CloudDownload, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { type RewardTrackListItem, useReloadRewardTracks, useRewardTracks } from '#/api/rewardTracks';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel, Td, Th } from '#/components/ui';
import { cx } from '#/lib/cx';

import { useTrackNames } from './hooks';
import { ImportTracks } from './ImportTracks';
import { css, STATUS, statusOf, themeOf, utcText } from './model';
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

/** Every track, in the order players get them, with where each stands now. */
const TrackList = ({ tracks, onOpen }: { tracks: RewardTrackListItem[]; onOpen: (id: string) => void }) => {
    const names = useTrackNames(tracks.map(x => x.id));

    if (tracks.length === 0) return <EmptyState>No reward tracks yet. Make one, or take Habbo's in from a capture.</EmptyState>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr>
                        <Th>Track</Th>
                        <Th>Status</Th>
                        <Th>Schedule (UTC)</Th>
                        <Th className="text-right">Tasks</Th>
                        <Th className="text-right">Prizes</Th>
                        <Th>Premium</Th>
                    </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                    {tracks.map((track) => {
                        const status = STATUS[statusOf(track)];

                        return (
                            <tr key={track.id} onClick={() => onOpen(track.id)} className="cursor-pointer hover:bg-subtle/60">
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
                                <Td><span title={status.meaning}><Badge tone={status.tone}>{status.label}</Badge></span></Td>
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
            <span className="text-xs text-muted">{clash ? 'A track has that id.' : 'Its texts are reward_track.<id>.name, .desc and .info; it starts off.'}</span>
        </form>
    );
};

/**
 * The reward tracks of the Progression menu: the list with where each stands (on, scheduled,
 * ended), a track's editor (settings, premium, tasks and their levels, prizes, and the prize strip
 * as the client draws it), and taking Habbo's tracks in from a capture of what its client was sent
 * at login, planned before anything changes. Every change is sent to the players online at once.
 */
export const RewardTracksPage = () => {
    const [ params, setParams ] = useSearchParams();
    const { data, error } = useRewardTracks();
    const reload = useReloadRewardTracks();
    const [ making, setMaking ] = useState(false);
    const trackId = params.get('track');
    const importing = params.get('view') === 'import';
    const go = (next: Record<string, string>) => setParams(next);

    if (trackId && data)
        return <TrackEditor key={trackId} id={trackId} isNew={!data.tracks.some(x => x.id === trackId)} actionTypes={data.actionTypes} onBack={() => go({})} />;

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
                        <Button variant="secondary" icon={<CloudDownload />} onClick={() => go({ view: 'import' })}>Import from Habbo</Button>
                        <Button icon={<Plus />} onClick={() => setMaking(x => !x)}>New track</Button>
                    </>
                )}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!data && !error && <Loading />}
                {data && importing && <ImportTracks onOpen={id => go({ track: id })} />}
                {data && !importing && (
                    <Panel title="Tracks" description="Players get the live ones at login, in this order. A change here is sent to everyone online at once.">
                        {making && <NewTrack taken={data.tracks.map(x => x.id)} onMake={id => go({ track: id })} />}
                        <TrackList tracks={data.tracks} onOpen={id => go({ track: id })} />
                    </Panel>
                )}
            </PageBody>
        </>
    );
};
