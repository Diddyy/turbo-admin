import { Download } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { useRewardTracks } from '#/api/rewardTracks';
import { Badge, Button, Input, Label, Labeled, Segmented, Select, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

import {
    AUDIENCE_OPTIONS, AUTO_OPEN_NOT_CLAIMED, CLOSE_OPTIONS, CONDITION_REWARD_TRACK, DEFAULT_COLOR, descKey, fromLocalInput, habboDifferences, type Notice, NOTICE_TYPES, type NoticeField,
    type NoticeText, parseColor, splitCondition, toLocalInput,
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

/** One notice's words, picture, look, click, closing, and when it shows and to whom. */
export const NoticeEditor = ({ notice, onChange, disabled }: { notice: Notice; onChange: (notice: Notice) => void; disabled: boolean }) => {
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

/** Habbo's version of the notice beside the hotel's: what differs, and taking Habbo's again. */
export const HabboCompare = ({ notice, habbo, wordsKnown, onTake, disabled }: { notice: Notice; habbo: Notice | undefined; wordsKnown: boolean; onTake: () => void; disabled: boolean }) => {
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
            </div>
            <Button variant="secondary" icon={<Download />} disabled={disabled || differences.length === 0} onClick={onTake}>Use Habbo&apos;s version</Button>
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
