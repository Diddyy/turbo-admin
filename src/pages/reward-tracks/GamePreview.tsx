import { useEffect, useRef, useState } from 'react';

import type { RewardTrack } from '#/api/rewardTracks';
import { Input, Labeled, Switch } from '#/components/ui';

import { rewardTracksMessage } from './model';

/** `reward_track_main_xml`'s size; the frame is a little larger, as the window is centred in it. */
const FRAME_WIDTH = 1120;
const FRAME_HEIGHT = 740;

/** The `type` every message to and from the client's preview host carries. */
const MESSAGE_TYPE = 'nitro-preview';

/** Edits are sent once typing pauses, as the client builds the window again for each. */
const SEND_DELAY_MS = 150;

type HostMessage = { type: typeof MESSAGE_TYPE; event: 'ready' | 'shown' | 'error'; message?: string };

const isHostMessage = (data: unknown): data is HostMessage => (typeof data === 'object') && (data !== null) && ((data as HostMessage).type === MESSAGE_TYPE);

/**
 * The track's window as the game draws it: the client's own preview host in a frame, sent the
 * draft - unsaved edits included - as the `RewardTracks` message a player with these points would
 * get. The client only listens to the origins its `preview.allowed_origins` names, so until the
 * hotel names the panel's there, the frame stays on the client's loading screen.
 */
export const GamePreview = ({ track, url }: { track: RewardTrack; url: string }) => {
    const frame = useRef<HTMLIFrameElement>(null);
    const [ ready, setReady ] = useState(false);
    const [ error, setError ] = useState<string | null>(null);
    const [ points, setPoints ] = useState(0);
    const [ premium, setPremium ] = useState(false);
    const origin = new URL(url).origin;

    useEffect(() => {
        const onMessage = (event: MessageEvent<unknown>) => {
            if ((event.origin !== origin) || (event.source !== frame.current?.contentWindow) || !isHostMessage(event.data)) return;

            if (event.data.event === 'ready') setReady(true);
            else setError((event.data.event === 'error') ? (event.data.message ?? 'error') : null);
        };

        window.addEventListener('message', onMessage);

        return () => window.removeEventListener('message', onMessage);
    }, [ origin ]);

    useEffect(() => {
        if (!ready) return;

        const timer = window.setTimeout(() => frame.current?.contentWindow?.postMessage({
            type: MESSAGE_TYPE,
            window: 'rewardtrack',
            data: rewardTracksMessage(track, points, premium),
            trackId: track.id,
        }, origin), SEND_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [ ready, track, points, premium, origin ]);

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-4">
                <Labeled label="Player's points" hint="Prizes up to these points can be claimed.">
                    <Input type="number" min={0} value={points} onChange={event => setPoints(Math.max(0, Math.floor(Number(event.target.value) || 0)))} className="w-32 font-mono" aria-label="Player's points" />
                </Labeled>
                {track.premium && <Switch label="Premium bought" checked={premium} onChange={setPremium} />}
                <span className="ml-auto text-xs text-muted">{!ready ? 'Waiting for the client' : error ? `The client could not show it: ${error}` : 'The game\'s own window'}</span>
            </div>
            <div className="overflow-auto rounded-xl border border-line bg-black">
                <iframe
                    ref={frame}
                    src={url}
                    title="The track's window in the game"
                    style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}
                    className="block border-0"
                />
            </div>
        </div>
    );
};
