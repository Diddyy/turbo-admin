import { Save, UserMinus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { badgeUrl, useClientAssets } from '#/api/assets';
import { BADGE_RARITIES, type BadgeItem, useBadgeHolders, useBadges, useGiveBadge, useSaveText, useSetBadgeRarity, useTakeBadge } from '#/api/content';
import { useHotelViewTexts } from '#/api/hotelView';
import { useMe } from '#/api/queries';
import { ask } from '#/components/confirm';
import { SearchInput } from '#/components/SearchInput';
import { Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Select } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useDebounced } from '#/lib/debounce';

import { PlayerPicker } from './PlayerPicker';

/** What the client calls the badge and says of it: the external texts `badge_name_<code>` and `badge_desc_<code>`. */
const BadgeTexts = ({ code, canEdit }: { code: string; canEdit: boolean }) => {
    const keys = [ `badge_name_${code}`, `badge_desc_${code}` ];
    const { data } = useHotelViewTexts(keys);
    const save = useSaveText();
    const [ edits, setEdits ] = useState<Record<string, string>>({});
    const value = (key: string) => edits[key] ?? data?.texts.find(x => x.key === key)?.value ?? '';

    return (
        <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
            <Labeled label="Name" hint={`badge_name_${code}`}>
                <Input value={value(keys[0]!)} onChange={event => setEdits(previous => ({ ...previous, [keys[0]!]: event.target.value }))} disabled={!canEdit} />
            </Labeled>
            <Labeled label="Description" hint={`badge_desc_${code}`}>
                <Input value={value(keys[1]!)} onChange={event => setEdits(previous => ({ ...previous, [keys[1]!]: event.target.value }))} disabled={!canEdit} />
            </Labeled>
            {canEdit && (
                <Button
                    variant="secondary"
                    icon={<Save />}
                    disabled={Object.keys(edits).length === 0 || save.isPending}
                    onClick={async () => {
                        for (const [ key, text ] of Object.entries(edits)) await save.mutateAsync({ key, value: text });

                        setEdits({});
                    }}
                >
                    Save
                </Button>
            )}
            {save.error && <div className="sm:col-span-3"><ErrorNotice error={save.error} /></div>}
        </div>
    );
};

/** One badge: its words, who holds it, and giving it to another. */
const BadgeDetail = ({ badge, canManage }: { badge: BadgeItem; canManage: boolean }) => {
    const { data: me } = useMe();
    const { data, error } = useBadgeHolders(badge.code);
    const give = useGiveBadge();
    const take = useTakeBadge();

    return (
        <div className="flex flex-col gap-4">
            {me?.canViewGamedata && <BadgeTexts code={badge.code} canEdit={canManage} />}
            <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Held by {badge.holders}{badge.holders > (data?.holders.length ?? 0) && data ? `, the first ${data.holders.length} shown` : ''}</h3>
                {error && <ErrorNotice error={error} />}
                {!data && !error && <Loading />}
                {data && data.holders.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                        {data.holders.map(holder => (
                            <li key={holder.playerId} className="flex items-center gap-1 rounded-lg border border-line py-0.5 pr-1 pl-2.5 text-sm">
                                <Link to={`/players/${holder.playerId}`} className="text-accent hover:underline">{holder.name}</Link>
                                {holder.slot !== null && <span className="text-xs text-muted">worn</span>}
                                {canManage && (
                                    <IconButton
                                        label={`Take it from ${holder.name}`}
                                        icon={<UserMinus />}
                                        tone="bad"
                                        className="size-7 sm:size-7"
                                        disabled={take.isPending}
                                        onClick={() => ask({ title: `Take ${badge.code} from ${holder.name}?`, confirm: 'Take it' }, () => take.mutate({ code: badge.code, playerId: holder.playerId }))}
                                    />
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {canManage && (
                <Labeled label="Give it to">
                    <PlayerPicker onPick={player => ask({ title: `Give ${badge.code} to ${player.name}?`, confirm: 'Give' }, () => give.mutate({ code: badge.code, playerId: player.id }))} disabled={give.isPending} />
                </Labeled>
            )}
            {(give.error || take.error) && <ErrorNotice error={give.error ?? take.error} />}
        </div>
    );
};

/**
 * The hotel's badges: every code players hold or that has a rarity pinned, with how many hold it.
 * A badge's rarity, pinned here, reaches the badge directory on its next refresh. To give a badge
 * no one holds yet, find it by its code.
 */
export const BadgesTab = ({ canManage }: { canManage: boolean }) => {
    const assets = useClientAssets();
    const [ text, setText ] = useState('');
    const [ open, setOpen ] = useState<string | null>(null);
    const { data, error, isFetching } = useBadges(useDebounced(text.trim()));
    const rarity = useSetBadgeRarity();
    const typed = text.trim();
    const badges = data?.badges ?? [];
    const unheld = /^[A-Za-z0-9_]{1,64}$/.test(typed) && !badges.some(x => x.code === typed) ? { code: typed, holders: 0, rarity: null } : null;

    return (
        <Panel
            title="Badges"
            description="Every badge players hold or that has a pinned rarity, most held first; a hundred at most. A pinned rarity reaches the hotel within five minutes."
            className="overflow-clip"
        >
            <div className="border-b border-line p-3">
                <SearchInput value={text} onValueChange={setText} placeholder="Badge code" className="w-full sm:max-w-96" aria-label="Find badges" />
            </div>
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {data && badges.length === 0 && !unheld && <EmptyState>No badge has that code.</EmptyState>}
            <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-60')}>
                {[ ...(unheld ? [ unheld ] : []), ...badges ].map(badge => (
                    <li key={badge.code}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2">
                            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setOpen(open === badge.code ? null : badge.code)}>
                                <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-canvas">
                                    {badgeUrl(assets, badge.code) && <img src={badgeUrl(assets, badge.code)!} alt="" className="max-h-full max-w-full [image-rendering:pixelated]" />}
                                </span>
                                <span className="truncate font-mono text-[13px]">{badge.code}</span>
                                <span className="text-xs text-muted">{badge.holders === 0 ? 'held by no one' : `${badge.holders} hold it`}</span>
                            </button>
                            <Select
                                value={badge.rarity === null ? '' : String(badge.rarity)}
                                onChange={event => rarity.mutate({ code: badge.code, rarity: event.target.value === '' ? null : Number(event.target.value) })}
                                disabled={!canManage || rarity.isPending}
                                aria-label={`Rarity of ${badge.code}`}
                                className="h-10 w-full text-xs sm:h-8 sm:w-40"
                            >
                                <option value="">By how many hold it</option>
                                {Object.entries(BADGE_RARITIES).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                            </Select>
                        </div>
                        {open === badge.code && <div className="border-t border-line bg-subtle/40 p-4"><BadgeDetail badge={badge} canManage={canManage} /></div>}
                    </li>
                ))}
            </ul>
            {rarity.error && <div className="p-4"><ErrorNotice error={rarity.error} /></div>}
        </Panel>
    );
};
