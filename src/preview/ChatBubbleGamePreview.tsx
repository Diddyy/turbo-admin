import { useEffect, useRef, useState } from 'react';

import { useClientAssets } from '#/api/assets';

/** The `type` every message to and from the client's preview host carries. */
const MESSAGE_TYPE = 'nitro-preview';

/** A draft is sent once typing pauses: the client builds the style again for each. */
const SEND_DELAY_MS = 150;

/** The strip of the game's desktop the bubble is drawn on (at 20, 20). */
const FRAME_WIDTH = 1008;
const FRAME_HEIGHT = 150;

/** A chat style's draft as the client's bubble is built from it: its look, its flags and its bitmaps as addresses. */
export interface ChatBubbleDraft {
    assetId: string;
    regPoints: unknown;
    flags: Record<string, boolean>;
    /** Its bitmaps by file, as `data:` urls: what saving would send. */
    files: Record<string, string>;
    text: string;
    name: string;
    figure: string;
    /** The colour a colour layer takes: the speaker's shirt's. */
    color: number | null;
    width: number;
}

type HostMessage = { type: typeof MESSAGE_TYPE; event: 'ready' | 'shown' | 'error' | 'bubble'; message?: string; width?: number; height?: number; failed?: string[] };

const isHostMessage = (data: unknown): data is HostMessage => (typeof data === 'object') && (data !== null) && ((data as HostMessage).type === MESSAGE_TYPE);

/**
 * The bubble as the game draws it - the client's own preview host in a frame, sent the draft on every
 * change, so what a room would show is seen before the style is saved, the bundle built and published.
 * The client listens only to the origins its `preview.allowed_origins` names.
 */
export const ChatBubbleGamePreview = ({ draft }: { draft: ChatBubbleDraft | null }) => {
    const assets = useClientAssets();
    const url = assets?.preview || null;
    const frame = useRef<HTMLIFrameElement>(null);
    const [ ready, setReady ] = useState(false);
    const [ said, setSaid ] = useState<HostMessage | null>(null);
    const origin = url ? new URL(url).origin : null;
    // The draft by value: the editor builds a new object each render, which is not a new draft.
    const draftKey = draft ? JSON.stringify(draft) : null;

    useEffect(() => {
        if (!origin) return;

        const onMessage = (event: MessageEvent<unknown>) => {
            if ((event.origin !== origin) || (event.source !== frame.current?.contentWindow) || !isHostMessage(event.data)) return;

            if (event.data.event === 'ready') setReady(true);
            else if (event.data.event === 'bubble' || event.data.event === 'error') setSaid(event.data);
        };

        window.addEventListener('message', onMessage);

        return () => window.removeEventListener('message', onMessage);
    }, [ origin ]);

    useEffect(() => {
        if (!ready || !origin || !draftKey) return;

        const { assetId, regPoints, flags, files, text, name, figure, color, width } = JSON.parse(draftKey) as ChatBubbleDraft;
        const timer = window.setTimeout(() => frame.current?.contentWindow?.postMessage({
            type: MESSAGE_TYPE,
            window: 'chatbubble',
            style: { assetId, regPoints, ...flags },
            files,
            text,
            name,
            figure,
            color: color ?? undefined,
            width,
        }, origin), SEND_DELAY_MS);

        return () => window.clearTimeout(timer);
    }, [ ready, origin, draftKey ]);

    if (!url) return <p className="text-xs text-muted">No preview: the server knows no client to draw it with (Turbo:Admin:ClientPreviewUrl, else Turbo:Admin:ClientConfigUrl).</p>;

    const status = !ready
        ? 'Waiting for the client'
        : !draft
                ? 'Nothing to draw: the style has no look yet.'
                : said?.event === 'error'
                    ? `The client could not draw it: ${said.message ?? 'error'}`
                    : said?.event === 'bubble'
                        ? `As a room draws it, unsaved changes included: ${said.width} x ${said.height}${said.failed?.length ? `; ${said.failed.join(', ')} did not load` : ''}.`
                        : 'Drawing it...';

    return (
        <div className="flex flex-col gap-2" data-testid="chat-bubble-game-preview">
            <span className="text-xs text-muted" data-testid="chat-bubble-game-status">{status}</span>
            <div className="overflow-auto rounded-xl border border-line bg-black">
                <iframe ref={frame} src={url} title="The bubble in the game" style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }} className="block border-0" />
            </div>
        </div>
    );
};
