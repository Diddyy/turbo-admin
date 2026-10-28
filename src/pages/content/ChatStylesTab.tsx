/**
 * The chat bubbles players speak in, built as Nitro Studio builds them: every style the hotel has,
 * each drawn as a room draws it, and changed or copied into new ones.
 *
 * - The stage draws the style picked as the client does (`#/preview/chatBubble`): the client's own
 *   text, a name, words and a look to try, the speaker's head from the imager and their shirt's
 *   colour in a coloured bubble, at any of a room's bubble widths and chat font sizes, on a
 *   backdrop and at a zoom.
 * - A style says who may speak with it - the server checks each line by its flags, and the client's
 *   picker offers it by the same - and how many own it and have it as their bubble.
 * - The style picked is open to change as it is, or is copied into a new one: its colours round the
 *   wheel and its bitmaps replaced; its words' face, size and colour; its flags; and its shape,
 *   every reg point, with the guides drawn over the bubble. Save shows once something is changed.
 *
 * Every change builds habbo-free-flow-chat-com again, which the publish targets send with the rest
 * and the client loads as the library's template bundle (`asset.bundles.templates`). The styles'
 * looks come in from the chat library of Habbo's HTML client (the release the hotel builds from),
 * or from a bundle file, taken in with the page header's Take in (`TakeInDialog`).
 */
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Cog, Copy, Crown, Dices, Flag, MessageCircle, Palette, RotateCcw, Save, Shapes, ShieldCheck, ShoppingCart, Sparkles, Star, Trash2, Type } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';

import { CHAT_STYLE_FILES, CHAT_STYLES, type ChatStyle, chatStyleBitmapPath, type ChatStyleFile, type ChatStyleInput, useChatStyles, useDeleteChatStyle, useSaveChatStyle } from '#/api/content';
import { ask } from '#/components/confirm';
import { SearchInput } from '#/components/SearchInput';
import { Tabs } from '#/components/Tabs';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useFillHeight } from '#/lib/fillHeight';
import { SAMPLE_LOOKS, useChatHead } from '#/preview/avatar';
import type { Backdrop } from '#/preview/backdrops';
import { CHAT_BUBBLE_WIDTH_NORMAL, CHAT_BUBBLE_WIDTH_THIN, CHAT_BUBBLE_WIDTH_WIDE, CHAT_FONT_SIZE_LABELS, CHAT_FONT_SIZE_SCALES, type ChatStyleRegPoints, DEFAULT_FONT_FACE, DEFAULT_FONT_SIZE, layoutBubble, NO_CHEST_COLOR, paintBubble, paintGuides, recolour, tintBackground } from '#/preview/chatBubble';
import { apiImageKey, apiImageQuery, base64Of, dataUrlOf, pngBase64, urlImageQuery, useApiImage } from '#/preview/images';
import { Stage, ToolChoice } from '#/preview/Stage';
import { useFlashFonts } from '#/preview/text';

import { BitmapsEditor, FlagsEditor, ShapeEditor, WordsEditor } from './chat-styles/editors';
import { FLAG_FIELDS, type Flags, flagsOf, STARTING_REG_POINTS, WHO_FLAGS } from './chat-styles/fields';
import { SpeakerEditor } from './chat-styles/Speaker';

const LIBRARY = 'habbo-free-flow-chat-com';

/** A style being changed or made: its fields, the style its bitmaps come from, and the recolouring over them. */
interface Draft {
    /** Null for a new one. */
    id: number | null;
    clientStyleId: number;
    assetId: string;
    flags: Flags;
    regPoints: ChatStyleRegPoints;
    /** The bitmaps it will have. */
    bitmaps: ChatStyleFile[];
    /** The style its bitmaps are drawn from until replaced: its own, the one it is a copy of, or the normal one lending a look. */
    from: number | null;
    hue: number;
    saturation: number;
    lightness: number;
    /** Pictures picked for its bitmaps, as data urls. */
    uploads: Partial<Record<ChatStyleFile, string>>;
}

type EditTab = 'look' | 'words' | 'shape' | 'flags';

type Filter = 'all' | 'players' | 'system' | 'nolook' | 'changed';

const FILTERS: { value: Filter; label: string; title: string }[] = [
    { value: 'all', label: 'All', title: 'Every style' },
    { value: 'players', label: 'Players', title: 'The ones players may pick' },
    { value: 'system', label: 'System', title: 'The hotel\'s own: bots, notifications, wired' },
    { value: 'nolook', label: 'No look', title: 'Not in the bundle: no reg points, or a bitmap missing' },
    { value: 'changed', label: 'Changed', title: 'Taken from Habbo\'s client and changed here since: a new release leaves them as they are' },
];

const WIDTHS = [ { value: CHAT_BUBBLE_WIDTH_THIN, label: 'Thin' }, { value: CHAT_BUBBLE_WIDTH_NORMAL, label: 'Normal' }, { value: CHAT_BUBBLE_WIDTH_WIDE, label: 'Wide' } ];

const WHO_ICONS: Partial<Record<keyof Flags, ReactNode>> = {
    clubOnly: <Crown className="size-3.5" />,
    purchasable: <ShoppingCart className="size-3.5" />,
    ambassadorOnly: <Star className="size-3.5" />,
    staffOnly: <ShieldCheck className="size-3.5" />,
    system: <Cog className="size-3.5" />,
};

/** Room round the bubble on the stage, in the bubble's pixels. */
const STAGE_PADDING = 24;

/** The bitmaps a recolouring changes; the colour layer is tinted anyway, and an icon or emblem is drawn as it is. */
const RECOLOURED: ChatStyleFile[] = [ 'chat_bubble_base', 'chat_bubble_pointer', 'selector_preview' ];

const flagLabel = (key: keyof Flags) => FLAG_FIELDS.find(x => x.key === key)!.label;

/** Each bitmap of a style as drawn: a picture picked for it, else the style's own from the server. */
const useStyleImages = (from: number | null, has: ChatStyleFile[], uploads: Partial<Record<ChatStyleFile, string>>) => {
    const results = useQueries({
        queries: CHAT_STYLE_FILES.map((file) => {
            const upload = uploads[file];

            return upload ? urlImageQuery(upload) : apiImageQuery(from !== null && has.includes(file) ? chatStyleBitmapPath(from, file) : null);
        }),
    });

    return Object.fromEntries(CHAT_STYLE_FILES.map((file, index) => [ file, results[index]?.data ?? null ])) as Record<ChatStyleFile, HTMLImageElement | null>;
};

const WhoIcons = ({ style }: { style: ChatStyle }) => {
    const on = WHO_FLAGS.filter(key => style[key]);

    return on.length > 0
        ? <span className="flex items-center gap-0.5 text-muted">{on.map(key => <span key={key} title={flagLabel(key)}>{WHO_ICONS[key]}</span>)}</span>
        : null;
};

/** A style in the grid: its picture in the client's picker, on a room's floor. */
const StyleCard = ({ style, selected, onPick }: { style: ChatStyle; selected: boolean; onPick: () => void }) => {
    const picture = useApiImage(style.bitmaps.includes('selector_preview') ? chatStyleBitmapPath(style.id, 'selector_preview') : null);

    return (
        <button
            type="button"
            onClick={onPick}
            aria-pressed={selected}
            className={cx('group flex min-w-0 flex-col overflow-hidden rounded-lg border text-left transition-colors', selected ? 'border-accent ring-2 ring-accent/25' : 'border-line hover:border-accent/50')}
        >
            <span className={cx('grid h-14 place-items-center bg-gradient-to-br from-[#8c7a58] to-[#6f6046]', !style.drawable && 'opacity-50')}>
                {picture
                    ? <img src={picture.src} alt="" className="max-h-9 transition-transform [image-rendering:pixelated] group-hover:scale-110" />
                    : <MessageCircle className="size-5 text-white/60" />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 px-2 py-1.5">
                <span className="truncate font-mono text-xs font-medium" title={style.assetId}>{style.assetId || 'unnamed'}</span>
                <span className="flex items-center justify-between gap-1 text-[11px] text-muted">
                    <span className="tabular-nums">
                        {`#${style.clientStyleId}`}
                        {style.changedHere && <span className="ml-1 text-accent" title="Changed here since it was taken from Habbo's client">changed</span>}
                    </span>
                    {style.drawable ? <WhoIcons style={style} /> : <span>no look</span>}
                </span>
            </span>
        </button>
    );
};

/** A style's name and id, as a panel's title, marked when it has no look. */
const StyleTitle = ({ style }: { style: ChatStyle }) => (
    <span className="flex flex-wrap items-center gap-2">
        <span className="font-mono">{style.assetId}</span>
        <span className="font-mono text-xs font-normal text-muted">{`#${style.clientStyleId}`}</span>
        {!style.drawable && <Badge tone="amber">no look</Badge>}
    </span>
);

/** How many own the style, and have it as their bubble. */
const usedBy = (style: ChatStyle) => [
    style.owners > 0 && `${style.owners.toLocaleString()} own it`,
    `${style.preferring.toLocaleString()} ${style.preferring === 1 ? 'has' : 'have'} it as their bubble`,
].filter(Boolean).join(' · ');

/** A style as a draft to change - `copy` makes a new one from it. One without a look borrows the normal bubble's. */
const draftOf = (style: ChatStyle, mode: 'edit' | 'copy', normal: ChatStyle | null, nextId: number): Draft => {
    const lookFrom = style.drawable ? style : normal?.drawable ? normal : style;
    const isNew = mode === 'copy';

    return {
        id: isNew ? null : style.id,
        clientStyleId: isNew ? nextId : style.clientStyleId,
        assetId: isNew ? `${style.assetId}_copy`.slice(0, 64) : style.assetId,
        // A copy is everyone's to start: who may use it is for the hotel to say again.
        flags: isNew ? { ...flagsOf(null), allowHtml: style.allowHtml, notification: style.notification } : flagsOf(style),
        regPoints: structuredClone(style.regPoints ?? lookFrom.regPoints ?? STARTING_REG_POINTS),
        bitmaps: [ ...lookFrom.bitmaps ],
        from: lookFrom.id,
        hue: 0,
        saturation: 100,
        lightness: 0,
        uploads: {},
    };
};

export const ChatStylesTab = ({ canManage }: { canManage: boolean }) => {
    const queryClient = useQueryClient();
    const { data, error } = useChatStyles();
    const save = useSaveChatStyle();
    const remove = useDeleteChatStyle();
    const fontsReady = useFlashFonts();
    const [ text, setText ] = useState('');
    const [ filter, setFilter ] = useState<Filter>('all');
    const [ picked, setPicked ] = useState<number | null>(null);
    // The changes made to the style picked, or a new style; null while the one picked is as saved.
    const [ draft, setDraft ] = useState<Draft | null>(null);
    const [ editTab, setEditTab ] = useState<EditTab>('look');
    const [ name, setName ] = useState('Habbo');
    const [ words, setWords ] = useState('Hello, what do you think of my bubble?');
    const [ figure, setFigure ] = useState(SAMPLE_LOOKS[0]!);
    const [ guides, setGuides ] = useState(true);
    const [ bubbleWidth, setBubbleWidth ] = useState(CHAT_BUBBLE_WIDTH_NORMAL);
    const [ fontSizeMode, setFontSizeMode ] = useState(0);
    const [ zoom, setZoom ] = useState(2);
    const [ backdrop, setBackdrop ] = useState<Backdrop>('room');
    const fillStyles = useFillHeight<HTMLElement>('(min-width: 80rem)');
    const { head, chestColor, unavailable } = useChatHead(figure);

    const items = useMemo(() => data?.items ?? [], [ data ]);
    const normal = items.find(x => x.clientStyleId === 0) ?? null;
    // Until one is picked, the normal bubble: the stage is never empty while there is one to draw.
    const current = items.find(x => x.id === picked) ?? (picked === null ? normal : null);
    // The style picked as it is saved, open to change for staff who may: no Edit to press first.
    const asSaved = useMemo(() => (canManage && current ? draftOf(current, 'edit', normal, 0) : null), [ canManage, current, normal ]);
    const editing = draft ?? asSaved;
    // Changed from what is saved, or a new one; a style with no look is given the one it borrows by saving.
    const changed = !!draft && (draft.id === null || JSON.stringify(draft) !== JSON.stringify(asSaved));
    const borrowing = !!editing && editing.id !== null && editing.from !== editing.id;
    const from = editing ? editing.from : current?.id ?? null;
    const fromStyle = items.find(x => x.id === from) ?? null;
    const images = useStyleImages(from, fromStyle?.bitmaps ?? [], editing?.uploads ?? {});
    const shownBitmaps = editing?.bitmaps ?? current?.bitmaps ?? [];
    const drawn = (file: ChatStyleFile) => (shownBitmaps.includes(file) ? images[file] : null);
    const regPoints = editing?.regPoints ?? current?.regPoints ?? null;
    const flags = editing?.flags ?? flagsOf(current);

    const base = drawn('chat_bubble_base');
    const pointer = drawn('chat_bubble_pointer');
    const colorLayer = drawn('chat_bubble_color');
    const icon = drawn('icon');
    const emblem = drawn('chat_bubble_emblem');
    const emblemMultiline = drawn('chat_bubble_emblem_multiline');
    const [ hue, saturation, lightness ] = editing ? [ editing.hue, editing.saturation / 100, editing.lightness / 100 ] : [ 0, 1, 0 ];
    const showGuides = !!editing && guides && editTab === 'shape';

    // The bubble, recoloured as asked, in the client's text at the room's width and font size, with room round it.
    const paint = useMemo(() => {
        if (!base || !regPoints)
            return null;

        return (canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) => {
            const background = tintBackground(recolour(base, hue, saturation, lightness), colorLayer, chestColor ?? NO_CHEST_COLOR);
            const shown = { base: background, pointer: pointer && recolour(pointer, hue, saturation, lightness), emblem, emblemMultiline, face: icon ?? head };
            const layout = layoutBubble(regPoints, shown, name, words, flags, { maxWidth: bubbleWidth, fontSizeScale: CHAT_FONT_SIZE_SCALES[fontSizeMode] });

            canvas.width = layout.bubbleWidth + STAGE_PADDING * 2;
            canvas.height = layout.bubbleHeight + STAGE_PADDING * 2;
            paintBubble(context, regPoints, shown, layout, STAGE_PADDING, STAGE_PADDING);

            if (showGuides)
                paintGuides(context, regPoints, background, layout, STAGE_PADDING, STAGE_PADDING);
        };
        // `fontsReady`: drawn again in the client's text once its fonts are in.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ base, pointer, colorLayer, icon, emblem, emblemMultiline, head, chestColor, regPoints, hue, saturation, lightness, name, words, flags.system, flags.notification, bubbleWidth, fontSizeMode, showGuides, fontsReady ]);

    if (error)
        return <ErrorNotice error={error} />;

    if (!data)
        return <Loading />;

    const query = text.trim().toLowerCase();
    const shown = items.filter(style => (!query || style.assetId.toLowerCase().includes(query) || String(style.clientStyleId) === query)
        && (filter === 'all' || (filter === 'nolook' ? !style.drawable : filter === 'changed' ? style.changedHere : filter === 'system' ? style.system : !style.system)));
    const drawable = items.filter(x => x.drawable).length;

    // The first change starts the draft from the style as saved.
    const update = (apply: (into: Draft) => Draft) => setDraft((was) => {
        const into = was ?? asSaved;

        return into ? apply(into) : was;
    });
    const change = (next: Partial<Draft>) => update(into => ({ ...into, ...next }));
    const setRegPoints = (next: Partial<ChatStyleRegPoints>) => update(into => ({ ...into, regPoints: { ...into.regPoints, ...next } }));

    const pickPicture = (file: ChatStyleFile, picture: File) => {
        void dataUrlOf(picture).then(url => update(into => ({ ...into, uploads: { ...into.uploads, [file]: url } })), toastError);
    };

    /** Another style to look at and change; changes not saved are thrown away, once the viewer says so. */
    const pick = (style: ChatStyle) => {
        // The one open already: its changes stay.
        if (editing && editing.id === style.id)
            return;

        const go = () => {
            setDraft(null);
            setPicked(style.id);
        };

        if (!changed)
            go();
        else
            ask({ title: `Throw away the changes to ${editing?.id === null ? 'the new style' : current?.assetId}?`, body: 'They are not saved.', confirm: 'Throw them away' }, go);
    };

    /** The draft as the server takes it: each bitmap that is not the style's own as it was, as a PNG. */
    const inputOf = (target: Draft): ChatStyleInput => {
        const recoloured = !!target.hue || target.saturation !== 100 || !!target.lightness;
        // An existing style borrowing another's look is sent every bitmap; a new one copies the rest itself.
        const borrowing = target.id !== null && target.from !== target.id;
        const files: Partial<Record<ChatStyleFile, string | null>> = {};

        for (const file of CHAT_STYLE_FILES) {
            const image = images[file];
            const upload = target.uploads[file];
            const changes = RECOLOURED.includes(file) && recoloured;

            if (!target.bitmaps.includes(file)) {
                if (fromStyle?.bitmaps.includes(file) || upload)
                    files[file] = null;
            } else if (image && (upload || changes || borrowing)) {
                files[file] = changes ? pngBase64(recolour(image, target.hue, target.saturation / 100, target.lightness / 100)) : upload && upload.startsWith('data:image/png') ? base64Of(upload) : pngBase64(recolour(image, 0, 1, 0));
            }
        }

        return {
            clientStyleId: target.clientStyleId,
            assetId: target.assetId,
            ...target.flags,
            regPoints: target.regPoints,
            files,
            copyFrom: target.id === null && target.from !== null ? target.from : undefined,
        };
    };

    const saveDraft = (target: Draft) => save.mutate({ id: target.id, input: inputOf(target) }, {
        onSuccess: async ({ id }) => {
            // What was saved is the server's now: read it before letting go of the changes, so the editor never shows the old.
            await queryClient.refetchQueries({ queryKey: CHAT_STYLES });

            // Its pictures are fetched again: the server has them as saved.
            for (const file of CHAT_STYLE_FILES)
                queryClient.removeQueries({ queryKey: apiImageKey(chatStyleBitmapPath(id, file)) });

            toast(`Saved ${target.assetId}; the bundle is built again.`);
            setPicked(id);
            setDraft(null);
        },
        onError: toastError,
    });

    const editingNormal = editing?.id !== null && editing?.clientStyleId === 0;

    return (
        <div className="grid grid-cols-1 items-start gap-4 lg:gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
            <Panel
                title="Styles"
                description={`${items.length.toLocaleString()} styles, ${drawable.toLocaleString()} in ${LIBRARY}${data.bundle ? '' : ' (not built yet)'}.`}
                ref={fillStyles}
                className="flex flex-col overflow-clip xl:sticky xl:top-4 xl:max-h-(--fill-height)"
            >
                <div className="flex flex-col gap-2 p-3">
                    <SearchInput value={text} onValueChange={setText} placeholder="Name or id" aria-label="Find chat styles" className="w-full" />
                    <ToolChoice label="Show" value={filter} options={FILTERS} onChange={setFilter} />
                </div>
                {/* Rows as tall as their cards: a card clips its overflow, so a capped grid would otherwise squash them to fit rather than scroll. */}
                <div className="grid max-h-[45vh] min-h-0 auto-rows-max grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] content-start gap-2 overflow-y-auto border-t border-line p-3 xl:max-h-none">
                    {shown.map(style => (
                        <StyleCard
                            key={style.id}
                            style={style}
                            selected={(editing ? editing.id === style.id : current?.id === style.id)}
                            onPick={() => pick(style)}
                        />
                    ))}
                    {shown.length === 0 && <p className="col-span-full py-4 text-sm text-muted">{items.length === 0 ? 'No chat styles yet.' : 'No chat style is like that.'}</p>}
                </div>
            </Panel>
            <div className="flex min-w-0 flex-col gap-4">
                {items.length > 0 && drawable === 0 && (
                    <WarningNotice>{`No style has a look yet, so nothing is built into ${LIBRARY}. Take them in from Habbo's client or a bundle file with Take in, at the top of the page.`}</WarningNotice>
                )}
                <Stage
                    paint={paint}
                    zoom={zoom}
                    onZoom={setZoom}
                    backdrop={backdrop}
                    onBackdrop={setBackdrop}
                    corner={<SpeakerEditor name={name} onName={setName} words={words} onWords={setWords} figure={figure} onFigure={setFigure} unavailable={unavailable} />}
                    empty={(
                        <div className="rounded-xl bg-surface/90 px-6 py-5 text-center shadow-sm">
                            <Sparkles className="mx-auto mb-2 size-6 text-accent" />
                            <div className="text-sm font-medium">{regPoints && !base ? 'Drawing it...' : 'Nothing to draw'}</div>
                            <div className="text-xs text-muted">{current && !current.drawable ? 'It has no look yet: change it below to give it one.' : 'Pick a style with a look.'}</div>
                        </div>
                    )}
                    tools={(
                        <>
                            <span className="flex items-center gap-1.5">
                                Width
                                <ToolChoice label="Bubble width" value={bubbleWidth} options={WIDTHS.map(x => ({ ...x, title: `Wrapped at ${x.value}px, as a room set to ${x.label.toLowerCase()} bubbles` }))} onChange={setBubbleWidth} />
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Type className="size-3.5" />
                                <ToolChoice label="Font size" value={fontSizeMode} options={CHAT_FONT_SIZE_LABELS.map((label, mode) => ({ value: mode, label, title: `The chat font size ${label}: x${CHAT_FONT_SIZE_SCALES[mode]}` }))} onChange={setFontSizeMode} />
                            </span>
                        </>
                    )}
                />
                {/* Staff who may not change it see what it is. */}
                {current && !editing && (
                    <Panel
                        title={<StyleTitle style={current} />}
                        description={current.regPoints
                            ? `${current.regPoints.fontFace ?? DEFAULT_FONT_FACE} ${current.regPoints.fontSize ?? DEFAULT_FONT_SIZE}px words${current.bitmaps.length > 3 ? `, with ${current.bitmaps.filter(x => ![ 'chat_bubble_base', 'chat_bubble_pointer', 'selector_preview' ].includes(x)).join(', ')}` : ''}.`
                            : 'No reg points: the client cannot draw it until it has a look.'}
                    >
                        <div className="flex flex-wrap items-center gap-1.5 px-4 py-3">
                            {FLAG_FIELDS.filter(x => current[x.key]).map(x => <Badge key={x.key} tone={x.key === 'system' ? 'neutral' : x.group === 'who' ? 'accent' : 'green'}>{x.label}</Badge>)}
                            {!WHO_FLAGS.some(key => current[key]) && <span className="text-xs text-muted">Anyone may speak with it.</span>}
                            <span className="ml-auto text-xs text-muted">{usedBy(current)}</span>
                        </div>
                    </Panel>
                )}
                {editing && (
                    <Panel
                        title={editing.id === null || !current ? 'A new style' : <StyleTitle style={current} />}
                        description={editing.id === null
                            ? `A copy of ${fromStyle?.assetId ?? 'a style'}, not saved yet.`
                            : borrowing
                                ? `It has no look yet: it starts with ${fromStyle?.assetId ?? 'the normal bubble'}'s, which saving gives it.`
                                : current && usedBy(current)}
                        actions={!changed && editing.id !== null && current && (
                            <>
                                <Button variant="secondary" icon={<Copy />} disabled={!current.drawable} onClick={() => setDraft(draftOf(current, 'copy', normal, data.nextId))}>Make a copy</Button>
                                {current.clientStyleId !== 0 && current.owners === 0 && (
                                    <IconButton
                                        label={`Delete ${current.assetId}`}
                                        icon={<Trash2 />}
                                        tone="bad"
                                        disabled={remove.isPending}
                                        onClick={() => ask(
                                            {
                                                title: `Delete the chat style ${current.assetId}?`,
                                                body: `It goes from the server and from ${LIBRARY}${current.preferring > 0 ? `; the ${current.preferring.toLocaleString()} who have it as their bubble talk in the normal one` : ''}.`,
                                                confirm: 'Delete',
                                            },
                                            () => remove.mutate(current.id, {
                                                onSuccess: () => {
                                                    toast(`Deleted ${current.assetId}.`);
                                                    setPicked(null);
                                                },
                                                onError: toastError,
                                            }),
                                        )}
                                    />
                                )}
                            </>
                        )}
                    >
                        <div className="grid grid-cols-1 gap-3 border-b border-line p-4 sm:grid-cols-2">
                            <Labeled label="Its name" hint="The client's asset id for it: letters, digits, _ and -. Its bitmaps are named after it.">
                                <Input
                                    value={editing.assetId}
                                    onChange={event => change({ assetId: event.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) })}
                                    spellCheck={false}
                                    autoComplete="off"
                                    className="w-full font-mono"
                                />
                            </Labeled>
                            <Labeled label="Its id" hint="What the server sends for a bubble in it.">
                                <Input
                                    value={String(editing.clientStyleId)}
                                    inputMode="numeric"
                                    disabled={editingNormal}
                                    onChange={event => change({ clientStyleId: Number(event.target.value.replace(/\D/g, '') || 0) })}
                                    className="w-full font-mono"
                                />
                            </Labeled>
                        </div>
                        <Tabs
                            value={editTab}
                            onChange={value => setEditTab(value as EditTab)}
                            label="What to change"
                            className="px-2"
                            tabs={[
                                { value: 'look', label: 'Look', icon: <Palette /> },
                                { value: 'words', label: 'Words', icon: <Type /> },
                                { value: 'shape', label: 'Shape', icon: <Shapes /> },
                                { value: 'flags', label: 'Flags', icon: <Flag /> },
                            ]}
                        />
                        <div className="p-4">
                            {editTab === 'look' && (
                                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                                    <div className="flex flex-col gap-3">
                                        <span className="text-sm font-medium">The bubble's colours</span>
                                        {([
                                            { label: 'Hue', key: 'hue', min: -180, max: 180, unit: '°' },
                                            { label: 'Richness', key: 'saturation', min: 0, max: 200, unit: '%' },
                                            { label: 'Lightness', key: 'lightness', min: -80, max: 80, unit: '%' },
                                        ] as const).map(slider => (
                                            <label key={slider.key} className="flex flex-col gap-1 text-xs">
                                                <span className="flex justify-between text-muted">
                                                    {slider.label}
                                                    <span className="font-mono">{`${editing[slider.key]}${slider.unit}`}</span>
                                                </span>
                                                <input type="range" min={slider.min} max={slider.max} value={editing[slider.key]} onChange={event => change({ [slider.key]: Number(event.target.value) })} className="w-full accent-accent" />
                                            </label>
                                        ))}
                                        <span className="flex flex-wrap gap-2">
                                            <Button
                                                variant="secondary"
                                                icon={<Dices />}
                                                onClick={() => {
                                                    const random = (count: number) => Math.floor(Math.random() * count);

                                                    change({ hue: random(360) - 180, saturation: 60 + random(100), lightness: random(40) - 20 });
                                                }}
                                            >
                                                Surprise me
                                            </Button>
                                            {(editing.hue !== 0 || editing.saturation !== 100 || editing.lightness !== 0) && <Button variant="secondary" onClick={() => change({ hue: 0, saturation: 100, lightness: 0 })}>As drawn</Button>}
                                        </span>
                                        <p className="text-xs text-muted">The bubble, its pointer and its picture in the picker are recoloured when it is saved.</p>
                                    </div>
                                    <BitmapsEditor
                                        bitmaps={editing.bitmaps}
                                        available={fromStyle?.bitmaps ?? []}
                                        uploads={editing.uploads}
                                        sizes={Object.fromEntries(CHAT_STYLE_FILES.flatMap(file => (images[file] ? [ [ file, { width: images[file].width, height: images[file].height } ] ] : [])))}
                                        onPicture={pickPicture}
                                        onBitmaps={next => change({ bitmaps: next })}
                                    />
                                </div>
                            )}
                            {editTab === 'words' && <WordsEditor regPoints={editing.regPoints} onChange={setRegPoints} />}
                            {editTab === 'shape' && <ShapeEditor regPoints={editing.regPoints} baseHeight={base?.height ?? 24} guides={guides} onGuides={setGuides} onChange={setRegPoints} />}
                            {editTab === 'flags' && <FlagsEditor flags={editing.flags} normal={editingNormal} onChange={next => change({ flags: next })} />}
                        </div>
                    </Panel>
                )}
                {/* Only once there is something to save: in sight wherever the editor is scrolled to. */}
                {editing && (changed || borrowing) && (
                    <div className="sticky bottom-3 z-20 rounded-xl border border-accent/40 bg-surface/95 shadow-lg backdrop-blur">
                        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <span className="min-w-0 text-sm">
                                {editing.id === null
                                    ? <>The new style <span className="font-mono">{editing.assetId || 'unnamed'}</span> is not saved yet</>
                                    : changed
                                        ? <>Changes to <span className="font-mono">{current?.assetId}</span> not saved</>
                                        : <><span className="font-mono">{current?.assetId}</span> has no look yet: saving gives it this one</>}
                                <span className="text-muted max-sm:hidden">{` · saved, it is built into ${LIBRARY} at once`}</span>
                            </span>
                            <span className="ml-auto flex gap-2">
                                {draft && <Button variant="ghost" icon={<RotateCcw />} disabled={save.isPending} onClick={() => setDraft(null)}>{draft.id === null ? 'Cancel' : 'Discard'}</Button>}
                                <Button icon={<Save />} disabled={save.isPending || !editing.assetId || !base} onClick={() => saveDraft(editing)}>{save.isPending ? 'Saving' : 'Save'}</Button>
                            </span>
                        </div>
                    </div>
                )}
                {!canManage && <p className="flex items-center gap-1.5 text-xs text-muted"><MessageCircle className="size-3.5" /> You can look, not change.</p>}
            </div>
        </div>
    );
};
