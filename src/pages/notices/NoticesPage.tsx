import { ArrowDown, ArrowLeft, ArrowUp, CloudDownload, Copy, Download, Eye, EyeOff, GitCompare, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useHotelView } from '#/api/hotelView';
import { type NoticeData, type NoticeSave, useNotices, useSaveNotices } from '#/api/notices';
import { useRewardTracks } from '#/api/rewardTracks';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Label, Labeled, Loading, PageBody, PageHeader, Panel, Segmented, Select, SuccessNotice, Textarea, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useFillHeight } from '#/lib/fillHeight';

import { HabboNotices } from './HabboNotices';
import { useHabboSet } from './hooks';
import {
    AUDIENCE_OPTIONS, AUTO_OPEN_NOT_CLAIMED, CLOSE_OPTIONS, CONDITION_REWARD_TRACK, copyNotice, countChanges, DEFAULT_COLOR, descKey, diffActive, diffNotice, diffNotices, freeKey, fromLocalInput,
    habboDifferences, type HabboStatus, habboStatus, hiddenReason, mergeSaves, newNotice, type Notice, NOTICE_TYPES, type NoticeField, type NoticeSet, type NoticeText, parseColor, parseNoticeData,
    sameNotice, splitCondition, takeHabbos, toLocalInput, validKey,
} from './model';
import { NoticeImagePicker } from './NoticeImagePicker';
import { NoticePreview } from './NoticePreview';

/** Where a notice's click goes: a client link, a web page, or nowhere. */
type LinkKind = 'internal' | 'external' | 'none';

/** Client links Habbo's notices use, offered as the link is typed. */
const KNOWN_LINKS = [
    'reward_track/open/introduction', 'catalog/open/<page>', 'questengine/achievements/new', 'dailytasks/open', 'wiredmenu/open',
    'special_items_display/<id>', 'cursed_dragon_adoption/open', 'navigator/goto/<room id>',
];

/** A field only this hotel's client reads: Habbo's has nothing for it. */
const Ours = () => <Badge className="ml-1 align-middle">this hotel</Badge>;

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <section className="flex flex-col gap-3 border-t border-line px-4 py-4 first:border-t-0">
        <Label as="h3">{title}</Label>
        {children}
    </section>
);

const NoticeEditor = ({ notice, onChange, disabled }: { notice: Notice; onChange: (notice: Notice) => void; disabled: boolean }) => {
    const { data: tracks } = useRewardTracks();
    const set = (field: NoticeField, value: string) => onChange({ ...notice, fields: { ...notice.fields, [field]: value } });
    const setText = (text: NoticeText, value: string) => onChange({ ...notice, texts: { ...notice.texts, [text]: value } });
    const linkKind: LinkKind = notice.fields.internal_link ? 'internal' : notice.fields.external_link ? 'external' : 'none';
    const [ kind, setKind ] = useState<LinkKind>(linkKind);
    const condition = splitCondition(notice.fields.condition);
    const autoOpen = splitCondition(notice.fields.auto_open_condition);
    const type = notice.fields.type || 'normal';
    const color = parseColor(notice.fields.color);

    const setLink = (value: string) => onChange({ ...notice, fields: { ...notice.fields, internal_link: kind === 'internal' ? value : '', external_link: kind === 'external' ? value : '' } });

    return (
        <fieldset disabled={disabled} className="flex flex-col">
            <Section title="Content">
                <Labeled label="Words" hint={notice.texts.desc ? `The text ${descKey(notice.key)}` : `No text ${descKey(notice.key)} yet: the client shows the key itself.`}>
                    <Textarea aria-label="Words" rows={3} value={notice.texts.desc} onChange={event => setText('desc', event.target.value)} className={cx(!notice.texts.desc && 'border-warn')} />
                </Labeled>
                {type === 'normal' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Labeled label="Open button" hint="Empty: the hotel's notifications.button.view, for every notice.">
                            <span className="flex items-center"><Input aria-label="Open button" value={notice.texts.open_button} onChange={event => setText('open_button', event.target.value)} placeholder="Open" className="flex-1" /><Ours /></span>
                        </Labeled>
                        <Labeled label="Close link" hint="Empty: the hotel's notifications.button.cancel, for every notice.">
                            <span className="flex items-center"><Input aria-label="Close link" value={notice.texts.cancel_link} onChange={event => setText('cancel_link', event.target.value)} placeholder="Close" className="flex-1" /><Ours /></span>
                        </Labeled>
                    </div>
                )}
                <p className="text-xs text-muted">Habbo&apos;s notices have no title: the words are all the text they show.</p>
            </Section>
            <Section title="Picture">
                <NoticeImagePicker value={notice.fields.image} onChange={value => set('image', value)} disabled={disabled} />
            </Section>
            <Section title="Look">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Labeled label="Style" hint="Normal: filled, with Open and Close. Promo: a coloured border, the whole of it a link. Countdown: a promo with a clock.">
                        <Segmented label="Style" value={type} onChange={value => set('type', value === 'normal' ? '' : value)} options={NOTICE_TYPES} />
                    </Labeled>
                    <Labeled label="Colour" hint={`#rrggbb; none is ${DEFAULT_COLOR}`}>
                        <span className="flex items-center gap-2">
                            <input type="color" aria-label="Colour picker" value={color ?? DEFAULT_COLOR} onChange={event => set('color', event.target.value)} className="h-8 w-10 rounded border border-line bg-canvas" />
                            <Input aria-label="Colour" value={notice.fields.color} onChange={event => set('color', event.target.value)} placeholder={DEFAULT_COLOR} className="font-mono" />
                        </span>
                    </Labeled>
                </div>
            </Section>
            <Section title="Click">
                <Labeled label="Click opens" hint="A client link (as the game's links write it), else a web page in the player's browser.">
                    <span className="flex flex-col gap-2">
                        <Segmented
                            label="Click opens"
                            value={kind}
                            onChange={(value) => {
                                setKind(value as LinkKind);
                                const current = notice.fields.internal_link || notice.fields.external_link;
                                onChange({ ...notice, fields: { ...notice.fields, internal_link: value === 'internal' ? current : '', external_link: value === 'external' ? current : '' } });
                            }}
                            options={[ { value: 'internal', label: 'Client link' }, { value: 'external', label: 'Web page' }, { value: 'none', label: 'Nothing' } ]}
                        />
                        {kind !== 'none' && (
                            <>
                                <Input aria-label="Link" list="notice-links" value={notice.fields.internal_link || notice.fields.external_link} onChange={event => setLink(event.target.value)} placeholder={kind === 'internal' ? 'reward_track/open/introduction' : 'https://'} className="font-mono" />
                                <datalist id="notice-links">{KNOWN_LINKS.map(x => <option key={x} value={x} />)}</datalist>
                            </>
                        )}
                    </span>
                </Labeled>
            </Section>
            <Section title="Closing">
                <Labeled
                    label="The player can close it"
                    hint={type === 'normal'
                        ? 'Habbo\'s: Close takes it down until the player next logs in.'
                        : 'Habbo\'s: a promo\'s close button only shows once it has been clicked open (a countdown\'s from the start), and takes it down until the next login.'}
                >
                    <span className="flex items-center">
                        <Segmented label="The player can close it" value={notice.fields.close} onChange={value => set('close', value)} options={CLOSE_OPTIONS} />
                        <Ours />
                    </span>
                </Labeled>
                {notice.fields.close === 'forever' && <p className="text-xs text-muted">Remembered in the player&apos;s browser. To show it to everyone again, duplicate it under a new key.</p>}
            </Section>
            <Section title="When shown">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Labeled label="Shown from" hint="The server's time. Empty: at once. Reached while a player is on, it docks then.">
                        <span className="flex items-center"><Input aria-label="Shown from" type="datetime-local" value={toLocalInput(notice.fields.show_from)} onChange={event => set('show_from', fromLocalInput(event.target.value))} className="flex-1" /><Ours /></span>
                    </Labeled>
                    <Labeled label="Gone after" hint="The server's time. A player loading the client after it sees none.">
                        <Input aria-label="Gone after" type="datetime-local" value={toLocalInput(notice.fields.expiry)} onChange={event => set('expiry', fromLocalInput(event.target.value))} />
                    </Labeled>
                    {type === 'countdown' && (
                        <Labeled label="Counts down to" hint="The server's time.">
                            <Input aria-label="Counts down to" type="datetime-local" value={toLocalInput(notice.fields.count_down_to)} onChange={event => set('count_down_to', fromLocalInput(event.target.value))} />
                        </Labeled>
                    )}
                    <Labeled label="Who sees it" hint="New players: while the server calls them new.">
                        <span className="flex items-center">
                            <Select aria-label="Who sees it" value={notice.fields.audience} onChange={event => set('audience', event.target.value)} className="flex-1">
                                {AUDIENCE_OPTIONS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                            </Select>
                            <Ours />
                        </span>
                    </Labeled>
                    <Labeled label="Shown while" hint="Hidden for a player who has finished the reward track.">
                        <span className="flex flex-col gap-2">
                            <Select aria-label="Shown while" value={condition.kind === CONDITION_REWARD_TRACK ? CONDITION_REWARD_TRACK : ''} onChange={event => set('condition', event.target.value ? `${CONDITION_REWARD_TRACK}:${condition.arg || tracks?.tracks[0]?.id || ''}` : '')}>
                                <option value="">Always</option>
                                <option value={CONDITION_REWARD_TRACK}>A reward track is not complete</option>
                            </Select>
                            {condition.kind === CONDITION_REWARD_TRACK && (
                                <Select aria-label="Reward track" value={condition.arg} onChange={event => set('condition', `${CONDITION_REWARD_TRACK}:${event.target.value}`)}>
                                    {!tracks?.tracks.some(x => x.id === condition.arg) && <option value={condition.arg}>{condition.arg || '(none)'}</option>}
                                    {tracks?.tracks.map(x => <option key={x.id} value={x.id}>{x.id}</option>)}
                                </Select>
                            )}
                        </span>
                    </Labeled>
                    <Labeled label="Opens itself" hint="After 5 seconds on the hotel view, until the player has claimed the product.">
                        <span className="flex flex-col gap-2">
                            <Select aria-label="Opens itself" value={autoOpen.kind === AUTO_OPEN_NOT_CLAIMED ? AUTO_OPEN_NOT_CLAIMED : ''} onChange={event => set('auto_open_condition', event.target.value ? `${AUTO_OPEN_NOT_CLAIMED}:${autoOpen.arg || notice.key}` : '')}>
                                <option value="">Never</option>
                                <option value={AUTO_OPEN_NOT_CLAIMED}>Until a product is claimed</option>
                            </Select>
                            {autoOpen.kind === AUTO_OPEN_NOT_CLAIMED && <Input aria-label="Claimed product" value={autoOpen.arg} onChange={event => set('auto_open_condition', `${AUTO_OPEN_NOT_CLAIMED}:${event.target.value}`)} className="font-mono" />}
                        </span>
                    </Labeled>
                </div>
            </Section>
        </fieldset>
    );
};

const HABBO_BADGE: Record<HabboStatus, ReactNode> = {
    same: <Badge>same as Habbo</Badge>,
    differs: <Badge tone="amber">differs from Habbo</Badge>,
    ours: <Badge>not on Habbo</Badge>,
};

const NoticeRow = ({ notice, selected, shownAt, dirty, habbo, onSelect, children }: { notice: Notice; selected: boolean; shownAt: number | null; dirty: boolean; habbo: HabboStatus | null; onSelect: () => void; children: ReactNode }) => {
    const hidden = hiddenReason(notice);

    return (
        <li className={cx('flex flex-wrap items-center gap-3 border-l-2 px-3 py-2', selected ? 'border-accent bg-accent-soft' : 'border-transparent')} data-selected={selected || undefined}>
            <button type="button" onClick={onSelect} aria-label={`Edit ${notice.key}`} aria-current={selected || undefined} className="flex min-w-0 flex-1 flex-col items-start gap-1.5 text-left">
                <NoticePreview notice={notice} />
                <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate font-mono text-xs">{notice.key}</span>
                    <span className="flex flex-wrap gap-1">
                        {shownAt !== null && <Badge tone="green">#{shownAt + 1}</Badge>}
                        {dirty && <Badge tone="accent">unsaved</Badge>}
                        {hidden === 'expired' && <Badge tone="amber">expired</Badge>}
                        {hidden === 'not yet' && <Badge tone="amber">not yet</Badge>}
                        {!notice.texts.desc && <Badge tone="amber">no words</Badge>}
                        {notice.fields.audience && <Badge>{AUDIENCE_OPTIONS.find(x => x.value === notice.fields.audience)?.label ?? notice.fields.audience}</Badge>}
                        {notice.fields.condition && <Badge>{notice.fields.condition}</Badge>}
                        {habbo && HABBO_BADGE[habbo]}
                    </span>
                </span>
            </button>
            <span className="flex items-center gap-1">{children}</span>
        </li>
    );
};

/** Habbo's version of the notice beside the hotel's: what differs, and taking Habbo's again. */
const HabboCompare = ({ notice, habbo, wordsKnown, onTake, disabled }: { notice: Notice; habbo: Notice | undefined; wordsKnown: boolean; onTake: () => void; disabled: boolean }) => {
    if (!habbo) return <p className="text-xs text-muted">Habbo has no notice {notice.key}: only this hotel has it.</p>;

    const differences = habboDifferences(notice, habbo, wordsKnown);

    return (
        <div className="flex flex-col gap-2" data-testid="habbo-compare">
            <div className="flex flex-wrap items-center gap-3">
                <NoticePreview notice={{ ...habbo, texts: { ...habbo.texts, desc: wordsKnown ? habbo.texts.desc : notice.texts.desc } }} />
                <span className="flex flex-col gap-1 text-xs">
                    {differences.length === 0 ? <Badge tone="green">Same as Habbo&apos;s</Badge> : <Badge tone="amber">{`${differences.length} ${differences.length === 1 ? 'difference' : 'differences'} from Habbo's`}</Badge>}
                    {!wordsKnown && <span className="text-muted">Habbo&apos;s words aren&apos;t known yet.</span>}
                </span>
                <Button variant="secondary" icon={<Download />} disabled={disabled || differences.length === 0} onClick={onTake} className="ml-auto">Use Habbo&apos;s version</Button>
            </div>
            {differences.length > 0 && (
                <table className="w-full text-xs">
                    <thead><tr className="text-left text-muted"><th className="py-1 pr-2 font-medium">Field</th><th className="py-1 pr-2 font-medium">Yours</th><th className="py-1 font-medium">Habbo&apos;s</th></tr></thead>
                    <tbody>
                        {differences.map(x => (
                            <tr key={x} className="border-t border-line align-top">
                                <td className="py-1 pr-2 font-mono">{x}</td>
                                <td className="py-1 pr-2 font-mono break-all">{(x === 'desc' ? notice.texts.desc : notice.fields[x]) || <span className="text-muted">none</span>}</td>
                                <td className="py-1 font-mono break-all">{(x === 'desc' ? habbo.texts.desc : habbo.fields[x]) || <span className="text-muted">none</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

const NoticesEditor = ({ server, canManage, save }: { server: NoticeData; canManage: boolean; save: ReturnType<typeof useSaveNotices> }) => {
    const saved = useMemo(() => parseNoticeData(server), [ server ]);
    // Only what is changed is kept here, over what the server holds: a save reading the notices back keeps the rest's edits.
    const [ drafts, setDrafts ] = useState<Record<string, Notice>>({});
    const [ activeDraft, setActiveDraft ] = useState<string[] | null>(null);
    const [ removed, setRemoved ] = useState<string[]>([]);
    const [ selected, setSelected ] = useState<string | null>(null);
    const [ adding, setAdding ] = useState('');
    const [ pulling, setPulling ] = useState(false);
    const [ comparing, setComparing ] = useState(false);
    const habbo = useHabboSet(comparing || pulling);
    const fillList = useFillHeight<HTMLElement>();
    const editor = useRef<HTMLElement>(null);
    const disabled = !canManage;

    const set = useMemo<NoticeSet>(() => {
        const notices = [
            ...saved.notices.filter(x => !removed.includes(x.key)).map(x => drafts[x.key] ?? x),
            ...Object.values(drafts).filter(x => !saved.notices.some(y => y.key === x.key) && !removed.includes(x.key)),
        ];

        return { notices, active: (activeDraft ?? saved.active).filter(key => notices.some(x => x.key === key)) };
    }, [ saved, drafts, activeDraft, removed ]);

    const savedOf = (key: string) => saved.notices.find(x => x.key === key);
    const dirty = (key: string) => {
        const draft = drafts[key];

        return !!draft && !sameNotice(draft, savedOf(key));
    };
    const orderDirty = set.active.join(',') !== saved.active.join(',');
    const changes = useMemo(() => diffNotices(set, server), [ set, server ]);
    const count = countChanges(changes);

    useEffect(() => {
        if (count === 0) return;

        const warn = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [ count ]);

    // A notice picked far down the list is edited where it can be seen: the editor's top brought into view.
    useEffect(() => {
        const top = editor.current?.getBoundingClientRect().top;

        if (selected && top !== undefined && (top < 0 || top > window.innerHeight - 160))
            editor.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }, [ selected ]);

    const notice = set.notices.find(x => x.key === selected) ?? null;
    const shown = set.active.map(key => set.notices.find(x => x.key === key)).filter((x): x is Notice => !!x);
    const hidden = set.notices.filter(x => !set.active.includes(x.key));
    const habboNotice = (key: string) => habbo.habbo?.notices.find(x => x.key === key);
    const habboOf = (x: Notice) => (habbo.habbo ? habboStatus(x, habboNotice(x.key), habbo.wordsKnown) : null);

    const update = (next: Notice) => setDrafts(previous => ({ ...previous, [next.key]: next }));
    const setActive = (change: (active: string[]) => string[]) => setActiveDraft(change(set.active));
    const move = (key: string, by: number) => setActive((active) => {
        const next = [ ...active ];
        const at = next.indexOf(key);
        const to = at + by;

        if (at < 0 || to < 0 || to >= next.length) return active;

        [ next[at], next[to] ] = [ next[to]!, next[at]! ];

        return next;
    });
    const setShown = (key: string, show: boolean) => setActive(active => (show ? [ ...active.filter(x => x !== key), key ] : active.filter(x => x !== key)));

    /** The saved shown keys with only this notice shown or hidden as it is here (its place in the order saves with the order). */
    const activeFor = (key: string, keep: boolean) => {
        const next = saved.active.filter(x => x !== key);

        if (keep && set.active.includes(key)) next.splice(Math.min(set.active.indexOf(key), next.length), 0, key);

        return next;
    };
    const forget = (key: string) => setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([ x ]) => x !== key)));
    const run = (changes: NoticeSave, done: () => void, message: string) => {
        if (countChanges(changes) === 0) return done();

        save.mutateAsync(changes).then(() => {
            done();
            toast(message);
        }, toastError);
    };

    const saveNotice = (key: string) => {
        const draft = set.notices.find(x => x.key === key)!;

        run(mergeSaves(diffNotice(key, draft, server), diffActive(activeFor(key, true), server)), () => forget(key), `Saved ${key}. Players see it when they next load the client.`);
    };
    const discardNotice = (key: string) => {
        forget(key);

        if (!savedOf(key)) {
            setActiveDraft(active => active && active.filter(x => x !== key));
            setSelected(null);
        }
    };
    const deleteNotice = (key: string) => ask({ title: `Delete ${key}?`, body: savedOf(key) ? 'Its variables and words are removed from the hotel now. The variables can be rolled back from the gamedata history.' : 'It was never saved.', confirm: 'Delete', danger: true }, () => {
        const gone = () => {
            forget(key);
            setActiveDraft(active => active && active.filter(x => x !== key));
            setRemoved(previous => previous.filter(x => x !== key));
            setSelected(null);
        };

        if (!savedOf(key)) return gone();

        run(mergeSaves(diffNotice(key, null, server), diffActive(activeFor(key, false), server)), gone, `Deleted ${key}.`);
    });
    const duplicate = (source: Notice) => {
        const key = freeKey(source.key, x => set.notices.some(y => y.key === x));

        update(copyNotice(source, key));
        setSelected(key);
    };
    const takeHabboOne = (theirs: Notice, wordsKnown: boolean) => {
        update(takeHabbos(set.notices.find(x => x.key === theirs.key), theirs, wordsKnown));

        if (!set.notices.some(x => x.key === theirs.key) && habbo.habbo?.active.includes(theirs.key)) setActive(active => [ ...active, theirs.key ]);

        setSelected(theirs.key);
    };
    const takeSet = (next: NoticeSet) => {
        setDrafts(Object.fromEntries(next.notices.map(x => [ x.key, x ])));
        setRemoved(saved.notices.filter(x => !next.notices.some(y => y.key === x.key)).map(x => x.key));
        setActiveDraft(next.active);
        setSelected(next.active[0] ?? null);
    };
    const discardAll = () => ask({ title: 'Discard every unsaved change?', confirm: 'Discard', danger: true }, () => {
        setDrafts({});
        setActiveDraft(null);
        setRemoved([]);
    });
    const saveAll = () => run(changes, () => {
        setDrafts({});
        setActiveDraft(null);
        setRemoved([]);
    }, 'Saved. Players see it when they next load the client.');
    const saveOrder = () => run(diffActive(set.active, server), () => setActiveDraft(null), 'Saved the order.');

    const addKey = adding.trim();
    const canAdd = validKey(addKey) && !set.notices.some(x => x.key === addKey);
    const add = () => {
        update(newNotice(addKey));
        setActive(active => [ ...active, addKey ]);
        setSelected(addKey);
        setAdding('');
    };

    const row = (x: Notice, shownAt: number | null, actions: ReactNode) => (
        <NoticeRow key={x.key} notice={x} selected={x.key === selected} shownAt={shownAt} dirty={dirty(x.key)} habbo={habboOf(x)} onSelect={() => setSelected(x.key)}>{actions}</NoticeRow>
    );

    return (
        <>
            <PageHeader title="Notices" description="The new feature notices docked under the purse: what they say and show, where they go, when and to whom">
                <Button variant="ghost" icon={<GitCompare />} onClick={() => setComparing(x => !x)} aria-pressed={comparing}>{comparing ? 'Hide Habbo\'s' : 'Compare with Habbo'}</Button>
                {canManage && <Button variant="secondary" icon={<CloudDownload />} onClick={() => setPulling(true)}>Copy Habbo's set</Button>}
                {count > 0 && <Button variant="ghost" icon={<RotateCcw />} onClick={discardAll}>Discard all</Button>}
                {canManage && (
                    <Button icon={<Save />} disabled={count === 0 || save.isPending} onClick={saveAll}>
                        {count > 0 ? `Save all (${count} ${count === 1 ? 'change' : 'changes'})` : 'All saved'}
                    </Button>
                )}
            </PageHeader>
            <HabboNotices open={pulling} onClose={() => setPulling(false)} current={set} dirty={dirty} onTake={takeSet} onTakeOne={takeHabboOne} />
            <PageBody className="flex flex-col gap-4">
                {save.error && <ErrorNotice error={save.error} />}
                {habbo.error && comparing && <ErrorNotice error={habbo.error} />}
                {!canManage && <WarningNotice>You can look, but changing notices needs the gamedata manage permission.</WarningNotice>}
                {save.isSuccess && count === 0 && (
                    <SuccessNotice>
                        Saved. The variables can be rolled back from <Link to="/gamedata/updates/history" className="underline">the gamedata history</Link>.
                    </SuccessNotice>
                )}
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
                    <aside ref={fillList} aria-label="Notices" className={cx('flex flex-col overflow-hidden rounded-xl border border-line bg-surface lg:sticky lg:top-6 lg:max-h-(--fill-height)', notice && 'max-lg:hidden')}>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
                                <div>
                                    <h2 className="text-[13px] font-semibold tracking-wide">Shown</h2>
                                    <p className="mt-0.5 text-xs text-muted">Top to bottom as the column docks them; one with an expiry or a countdown docks after the others.</p>
                                </div>
                                {orderDirty && canManage && <Button variant="secondary" icon={<Save />} disabled={save.isPending} onClick={saveOrder}>Save order</Button>}
                            </header>
                            {shown.length === 0 && <EmptyState>None shown.</EmptyState>}
                            <ul className="divide-y divide-line" data-testid="shown-notices">
                                {shown.map((x, index) => row(x, index, (
                                    <>
                                        <IconButton small label={`Move ${x.key} up`} icon={<ArrowUp />} disabled={disabled || index === 0} onClick={() => move(x.key, -1)} />
                                        <IconButton small label={`Move ${x.key} down`} icon={<ArrowDown />} disabled={disabled || index === shown.length - 1} onClick={() => move(x.key, 1)} />
                                        <IconButton small label={`Hide ${x.key}`} icon={<EyeOff />} disabled={disabled} onClick={() => setShown(x.key, false)} />
                                    </>
                                )))}
                            </ul>
                            <header className="border-y border-line px-4 py-3">
                                <h2 className="text-[13px] font-semibold tracking-wide">Not shown</h2>
                                <p className="mt-0.5 text-xs text-muted">Kept, ready to show again.</p>
                            </header>
                            {hidden.length === 0 && <EmptyState>Every notice is shown.</EmptyState>}
                            <ul className="divide-y divide-line" data-testid="hidden-notices">
                                {hidden.map(x => row(x, null, <IconButton small label={`Show ${x.key}`} icon={<Eye />} disabled={disabled} onClick={() => setShown(x.key, true)} />))}
                            </ul>
                        </div>
                        {canManage && (
                            <form
                                className="flex items-center gap-2 border-t border-line p-3"
                                onSubmit={(event) => {
                                    event.preventDefault();

                                    if (canAdd) add();
                                }}
                            >
                                <Input aria-label="New notice key" value={adding} onChange={event => setAdding(event.target.value)} placeholder="new_notice_key" className="flex-1 font-mono" />
                                <Button variant="secondary" icon={<Plus />} type="submit" disabled={!canAdd}>Add</Button>
                            </form>
                        )}
                    </aside>
                    {notice
                        ? (
                                <Panel
                                    ref={editor}
                                    className="flex scroll-mt-4 flex-col"
                                    title={(
                                        <span className="flex flex-wrap items-center gap-2">
                                            <Button variant="ghost" icon={<ArrowLeft />} onClick={() => setSelected(null)} className="lg:hidden">Notices</Button>
                                            <span className="font-mono" data-testid="editing-key">{notice.key}</span>
                                            {dirty(notice.key) && <Badge tone="accent">unsaved</Badge>}
                                            {!savedOf(notice.key) && <Badge tone="accent">new</Badge>}
                                        </span>
                                    )}
                                    description={set.active.includes(notice.key) ? `Shown, #${set.active.indexOf(notice.key) + 1}${hiddenReason(notice) ? ` - players don't see it now (${hiddenReason(notice)})` : ''}` : 'Not shown'}
                                    actions={canManage && (
                                        <>
                                            <IconButton label={`Duplicate ${notice.key}`} icon={<Copy />} onClick={() => duplicate(notice)} />
                                            <IconButton label={`Delete ${notice.key}`} tone="bad" icon={<Trash2 />} onClick={() => deleteNotice(notice.key)} />
                                        </>
                                    )}
                                >
                                    <div className="flex flex-wrap items-center justify-center gap-6 border-b border-line bg-[#0e1a2b] p-6" data-testid="notice-live-preview">
                                        <NoticePreview notice={notice} />
                                    </div>
                                    {comparing && (
                                        <Section title="Habbo's version">
                                            {habbo.habbo
                                                ? <HabboCompare notice={notice} habbo={habboNotice(notice.key)} wordsKnown={habbo.wordsKnown} disabled={disabled} onTake={() => takeHabboOne(habboNotice(notice.key)!, habbo.wordsKnown)} />
                                                : !habbo.error && <p className="text-xs text-muted">Reading Habbo&apos;s notices…</p>}
                                        </Section>
                                    )}
                                    <NoticeEditor key={notice.key} notice={notice} onChange={update} disabled={disabled} />
                                    {canManage && (
                                        <div className={cx('sticky bottom-0 z-10 flex flex-wrap items-center gap-2 rounded-b-xl border-t bg-surface/95 px-4 py-3 backdrop-blur', dirty(notice.key) ? 'border-accent/40' : 'border-line')}>
                                            <span className="mr-auto text-xs text-muted" data-testid="notice-state">{dirty(notice.key) ? 'Unsaved changes to this notice.' : 'Saved.'}</span>
                                            <Button variant="ghost" icon={<RotateCcw />} disabled={!dirty(notice.key)} onClick={() => discardNotice(notice.key)}>Discard</Button>
                                            <Button icon={<Save />} disabled={save.isPending || (!dirty(notice.key) && activeFor(notice.key, true).join(',') === saved.active.join(','))} onClick={() => saveNotice(notice.key)}>Save notice</Button>
                                        </div>
                                    )}
                                </Panel>
                            )
                        : <Panel className="max-lg:hidden"><EmptyState>Pick a notice on the left to edit it here.</EmptyState></Panel>}
                </div>
            </PageBody>
        </>
    );
};

/**
 * The new feature notices (Habbo's `notifications.new_feature.*`): which show, in which order, and
 * each one's words, picture, look, link, closing, when it shows and to whom - kept as the client's
 * own variables and texts, saved through them a notice at a time or all at once.
 */
export const NoticesPage = () => {
    const { data, error } = useNotices();
    const save = useSaveNotices();
    const { data: hotelView } = useHotelView();

    if (error) return <PageBody><ErrorNotice error={error} /></PageBody>;

    if (!data) return <Loading />;

    // Changing them is changing gamedata: the hotel view's own answer says whether this staff may.
    return <NoticesEditor server={data} canManage={!!hotelView?.canManage} save={save} />;
};
