import { ArrowDown, ArrowUp, CloudDownload, Eye, EyeOff, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useHotelView } from '#/api/hotelView';
import { type NoticeData, useNotices, useSaveNotices } from '#/api/notices';
import { useRewardTracks } from '#/api/rewardTracks';
import { ask } from '#/components/confirm';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, PageBody, PageHeader, Panel, Segmented, Select, SuccessNotice, Textarea, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';

import { HabboNotices } from './HabboNotices';
import {
    AUTO_OPEN_NOT_CLAIMED, CONDITION_REWARD_TRACK, countChanges, DEFAULT_COLOR, diffNotices, fromLocalInput, hasPassed, newNotice, type Notice, NOTICE_TYPES, type NoticeField, type NoticeSet,
    parseColor, parseNoticeData, splitCondition, toLocalInput, validKey,
} from './model';
import { NoticePreview } from './NoticePreview';

/** Where a notice's click goes: a client link, a web page, or nowhere. */
type LinkKind = 'internal' | 'external' | 'none';

/** Client links Habbo's notices use, offered as the link is typed. */
const KNOWN_LINKS = [
    'reward_track/open/introduction', 'catalog/open/<page>', 'questengine/achievements/new', 'dailytasks/open', 'wiredmenu/open',
    'special_items_display/<id>', 'cursed_dragon_adoption/open', 'navigator/goto/<room id>',
];

const NoticeEditor = ({ notice, onChange, disabled }: { notice: Notice; onChange: (notice: Notice) => void; disabled: boolean }) => {
    const { data: tracks } = useRewardTracks();
    const set = (field: NoticeField, value: string) => onChange({ ...notice, fields: { ...notice.fields, [field]: value } });
    const linkKind: LinkKind = notice.fields.internal_link ? 'internal' : notice.fields.external_link ? 'external' : 'none';
    const [ kind, setKind ] = useState<LinkKind>(linkKind);
    const condition = splitCondition(notice.fields.condition);
    const autoOpen = splitCondition(notice.fields.auto_open_condition);
    const type = notice.fields.type || 'normal';
    const color = parseColor(notice.fields.color);

    const setLink = (value: string) => onChange({ ...notice, fields: { ...notice.fields, internal_link: kind === 'internal' ? value : '', external_link: kind === 'external' ? value : '' } });

    return (
        <fieldset disabled={disabled} className="flex flex-col gap-4 p-4">
            <Labeled label="Words" hint={`The text notifications.new_feature.${notice.key}.desc`}>
                <Textarea aria-label="Words" rows={2} value={notice.desc} onChange={event => onChange({ ...notice, desc: event.target.value })} />
            </Labeled>
            <div className="grid gap-4 sm:grid-cols-2">
                <Labeled label="Look" hint="Normal: filled, with Open and Close. Promo: a coloured border, the whole of it a link. Countdown: a promo with a clock.">
                    <Segmented label="Look" value={type} onChange={value => set('type', value === 'normal' ? '' : value)} options={NOTICE_TYPES} />
                </Labeled>
                <Labeled label="Colour" hint={`#rrggbb; none is ${DEFAULT_COLOR}`}>
                    <span className="flex items-center gap-2">
                        <input type="color" aria-label="Colour picker" value={color ?? DEFAULT_COLOR} onChange={event => set('color', event.target.value)} className="h-8 w-10 rounded border border-line bg-canvas" />
                        <Input aria-label="Colour" value={notice.fields.color} onChange={event => set('color', event.target.value)} placeholder={DEFAULT_COLOR} className="font-mono" />
                    </span>
                </Labeled>
            </div>
            <Labeled label="Image" hint="One of the client's own images by name (reward_track_small_icon), or an address; ${image.library.url} is the client's image library.">
                <Input aria-label="Image" value={notice.fields.image} onChange={event => set('image', event.target.value)} className="font-mono" />
            </Labeled>
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
            <div className="grid gap-4 sm:grid-cols-2">
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
            <div className="grid gap-4 sm:grid-cols-2">
                <Labeled label="Gone after" hint="The server's time. A player loading the client after it sees none.">
                    <Input aria-label="Gone after" type="datetime-local" value={toLocalInput(notice.fields.expiry)} onChange={event => set('expiry', fromLocalInput(event.target.value))} />
                </Labeled>
                {type === 'countdown' && (
                    <Labeled label="Counts down to" hint="The server's time.">
                        <Input aria-label="Counts down to" type="datetime-local" value={toLocalInput(notice.fields.count_down_to)} onChange={event => set('count_down_to', fromLocalInput(event.target.value))} />
                    </Labeled>
                )}
            </div>
        </fieldset>
    );
};

const NoticeRow = ({ notice, selected, shownAt, onSelect, children }: { notice: Notice; selected: boolean; shownAt: number | null; onSelect: () => void; children: ReactNode }) => (
    <li className={cx('flex flex-wrap items-center gap-3 px-3 py-2', selected && 'bg-subtle')}>
        <button type="button" onClick={onSelect} aria-label={`Edit ${notice.key}`} className="flex min-w-0 flex-1 items-center gap-3 text-left">
            <NoticePreview notice={notice} missingText={!notice.desc} />
            <span className="flex min-w-0 flex-col gap-1">
                <span className="truncate font-mono text-xs">{notice.key}</span>
                <span className="flex flex-wrap gap-1">
                    {shownAt !== null && <Badge tone="green">#{shownAt + 1}</Badge>}
                    {hasPassed(notice.fields.expiry) && <Badge tone="amber">expired</Badge>}
                    {shownAt !== null && (notice.fields.expiry || (notice.fields.type === 'countdown' && notice.fields.count_down_to)) && <Badge>docks after the others</Badge>}
                    {notice.fields.condition && <Badge>{notice.fields.condition}</Badge>}
                </span>
            </span>
        </button>
        <span className="flex items-center gap-1">{children}</span>
    </li>
);

const NoticesEditor = ({ server, canManage, save }: { server: NoticeData; canManage: boolean; save: ReturnType<typeof useSaveNotices> }) => {
    const initial = useMemo(() => parseNoticeData(server), [ server ]);
    const [ set, setSet ] = useState<NoticeSet>(initial);
    const [ selected, setSelected ] = useState<string | null>(initial.active[0] ?? initial.notices[0]?.key ?? null);
    const [ adding, setAdding ] = useState('');
    const [ pulling, setPulling ] = useState(false);
    const changes = useMemo(() => diffNotices(set, server), [ set, server ]);
    const count = countChanges(changes);
    const disabled = !canManage;

    useEffect(() => {
        if (count === 0) return;

        const warn = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [ count ]);

    const notice = set.notices.find(x => x.key === selected) ?? null;
    const shown = set.active.map(key => set.notices.find(x => x.key === key)).filter((x): x is Notice => !!x);
    const hidden = set.notices.filter(x => !set.active.includes(x.key));
    const update = (next: Notice) => setSet(previous => ({ ...previous, notices: previous.notices.map(x => (x.key === next.key ? next : x)) }));
    const move = (key: string, by: number) => setSet((previous) => {
        const active = [ ...previous.active ];
        const at = active.indexOf(key);
        const to = at + by;

        if (at < 0 || to < 0 || to >= active.length) return previous;

        [ active[at], active[to] ] = [ active[to]!, active[at]! ];

        return { ...previous, active };
    });
    const setShown = (key: string, show: boolean) => setSet(previous => ({ ...previous, active: show ? [ ...previous.active.filter(x => x !== key), key ] : previous.active.filter(x => x !== key) }));
    const removeNotice = (key: string) => ask({ title: `Remove ${key}?`, body: 'Its variables and words go when you save.', confirm: 'Remove', danger: true }, () => {
        setSet(previous => ({ active: previous.active.filter(x => x !== key), notices: previous.notices.filter(x => x.key !== key) }));
        setSelected(null);
    });
    const take = (next: NoticeSet) => {
        setSet(next);
        setSelected(next.active[0] ?? null);
    };
    const addKey = adding.trim();
    const canAdd = validKey(addKey) && !set.notices.some(x => x.key === addKey);
    const add = () => {
        setSet(previous => ({ active: [ ...previous.active, addKey ], notices: [ ...previous.notices, newNotice(addKey) ] }));
        setSelected(addKey);
        setAdding('');
    };

    return (
        <>
            <PageHeader title="Notices" description="The new feature notices docked under the purse: what they say, where they go, in which order">
                {canManage && <Button variant="secondary" icon={<CloudDownload />} onClick={() => setPulling(true)}>Copy Habbo's set</Button>}
                {count > 0 && <Button variant="ghost" icon={<RotateCcw />} onClick={() => setSet(initial)}>Discard</Button>}
                {canManage && (
                    <Button icon={<Save />} disabled={count === 0 || save.isPending} onClick={() => save.mutate(changes)}>
                        {count > 0 ? `Save ${count} ${count === 1 ? 'change' : 'changes'}` : 'Saved'}
                    </Button>
                )}
            </PageHeader>
            <HabboNotices open={pulling} onClose={() => setPulling(false)} current={set} onTake={take} />
            <PageBody className="flex flex-col gap-4">
                {save.error && <ErrorNotice error={save.error} />}
                {save.isSuccess && count === 0 && (
                    <SuccessNotice>
                        Saved. Players see it when they next load the client. The variables can be rolled back from <Link to="/gamedata/updates/history" className="underline">the gamedata history</Link>.
                    </SuccessNotice>
                )}
                {!canManage && <WarningNotice>You can look, but changing notices needs the gamedata manage permission.</WarningNotice>}
                <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
                    <div className="flex flex-col gap-4">
                        <Panel title="Shown" description="Top to bottom as the column docks them; one with an expiry or a countdown docks after the others, once the server has answered its time.">
                            {shown.length === 0 && <EmptyState>None shown.</EmptyState>}
                            <ul className="divide-y divide-line" data-testid="shown-notices">
                                {shown.map((x, index) => (
                                    <NoticeRow key={x.key} notice={x} selected={x.key === selected} shownAt={index} onSelect={() => setSelected(x.key)}>
                                        <IconButton small label={`Move ${x.key} up`} icon={<ArrowUp />} disabled={disabled || index === 0} onClick={() => move(x.key, -1)} />
                                        <IconButton small label={`Move ${x.key} down`} icon={<ArrowDown />} disabled={disabled || index === shown.length - 1} onClick={() => move(x.key, 1)} />
                                        <IconButton small label={`Hide ${x.key}`} icon={<EyeOff />} disabled={disabled} onClick={() => setShown(x.key, false)} />
                                    </NoticeRow>
                                ))}
                            </ul>
                        </Panel>
                        <Panel title="Not shown" description="Kept, ready to show again.">
                            {hidden.length === 0 && <EmptyState>Every notice is shown.</EmptyState>}
                            <ul className="divide-y divide-line">
                                {hidden.map(x => (
                                    <NoticeRow key={x.key} notice={x} selected={x.key === selected} shownAt={null} onSelect={() => setSelected(x.key)}>
                                        <IconButton small label={`Show ${x.key}`} icon={<Eye />} disabled={disabled} onClick={() => setShown(x.key, true)} />
                                    </NoticeRow>
                                ))}
                            </ul>
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
                        </Panel>
                    </div>
                    {notice
                        ? (
                                <Panel
                                    title={<span className="font-mono">{notice.key}</span>}
                                    description={set.active.includes(notice.key) ? `Shown, #${set.active.indexOf(notice.key) + 1}` : 'Not shown'}
                                    actions={canManage && <IconButton label={`Remove ${notice.key}`} tone="bad" icon={<Trash2 />} onClick={() => removeNotice(notice.key)} />}
                                >
                                    <div className="flex justify-center border-b border-line bg-[#0e1a2b] p-6" data-testid="notice-live-preview">
                                        <NoticePreview notice={notice} missingText={!notice.desc} />
                                    </div>
                                    <NoticeEditor key={notice.key} notice={notice} onChange={update} disabled={disabled} />
                                </Panel>
                            )
                        : <Panel><EmptyState>Pick a notice to edit it.</EmptyState></Panel>}
                </div>
            </PageBody>
        </>
    );
};

/**
 * The new feature notices (Habbo's `notifications.new_feature.*`): which show, in which order, and
 * each one's words, look, image, link, condition, opening by itself and expiry - kept as the
 * client's own variables and texts, saved through them.
 */
export const NoticesPage = () => {
    const { data, error, dataUpdatedAt } = useNotices();
    // Here, not in the editor: the editor is built again once a save is read back, and says it saved.
    const save = useSaveNotices();
    const { data: hotelView } = useHotelView();

    if (error) return <PageBody><ErrorNotice error={error} /></PageBody>;

    if (!data) return <Loading />;

    // Changing them is changing gamedata: the hotel view's own answer says whether this staff may.
    // Built again from what the server holds once a save has been read back.
    return <NoticesEditor key={dataUpdatedAt} server={data} canManage={!!hotelView?.canManage} save={save} />;
};
