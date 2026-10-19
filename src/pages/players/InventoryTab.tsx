import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import type { ProductKind } from '#/api/catalog';
import { type PlayerDetailResponse, usePlayerAbilities, usePlayerInventory } from '#/api/players';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Loading, Panel, Stat } from '#/components/ui';
import { ProductIcon } from '#/pages/catalog/ProductIcon';

import { ActionAnswer } from './ActionAnswer';
import { BadgeSheet, FurnitureSheet } from './GrantSheets';
import { usePlayerAction } from './usePlayerAction';

const ROW = 'flex min-h-12 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0';

/** Whether a name holds the words typed, case ignored. */
const matches = (name: string, filter: string) => name.toLowerCase().includes(filter.trim().toLowerCase());

/**
 * What a player owns: how much at a glance, their furniture by kind with how many are in their
 * inventory and how many placed in rooms, and their badges (worn ones first, with their slot),
 * each list narrowed by name. Each list has its Add (furniture in their inventory or as a gift, a
 * badge by its code), and each badge a way to take it, where you may: the hotel's own commands,
 * run as you.
 */
export const InventoryTab = ({ player }: { player: PlayerDetailResponse }) => {
    const { data: inventory, error, isPending } = usePlayerInventory(player.id);
    const can = usePlayerAbilities().data;
    const action = usePlayerAction(player);
    const [ furniFilter, setFurniFilter ] = useState('');
    const [ badgeFilter, setBadgeFilter ] = useState('');
    const [ adding, setAdding ] = useState<'furniture' | 'badge' | null>(null);
    const addsFurniture = !!can && (can.giveItem || can.gift);

    if (isPending)
        return <Loading />;

    if (error)
        return <ErrorNotice error={error} />;

    const furniture = inventory.furniture.filter(item => matches(item.name, furniFilter));
    const badges = inventory.badges.filter(badge => matches(badge.code, badgeFilter));

    return (
        <div className="flex flex-col gap-4 lg:gap-5">
            <ActionAnswer action={action} />
            <section aria-label="What they own" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <Stat compact label="In inventory" value={inventory.furnitureInInventory.toLocaleString()} />
                <Stat compact label="Placed in rooms" value={inventory.furnitureInRooms.toLocaleString()} />
                <Stat compact label="Badges" value={inventory.badges.length.toLocaleString()} />
                <Stat compact label="Pets" value={inventory.pets.toLocaleString()} />
                <Stat compact label="Bots" value={inventory.bots.toLocaleString()} />
            </section>

            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-5">
                <Panel
                    title={`Furniture (${inventory.furniture.length.toLocaleString()} kinds)`}
                    actions={(
                        <>
                            {inventory.furniture.length > 0 && (
                                <SearchInput value={furniFilter} onValueChange={setFurniFilter} placeholder="Class name" aria-label="Filter furniture" className="w-44" />
                            )}
                            {addsFurniture && <Button variant="secondary" icon={<Plus />} onClick={() => setAdding('furniture')}>Add</Button>}
                        </>
                    )}
                >
                    {furniture.length === 0
                        ? <EmptyState>{inventory.furniture.length === 0 ? 'No furniture.' : 'No furniture matches.'}</EmptyState>
                        : (
                                <ul className="max-h-[36rem] overflow-y-auto">
                                    {furniture.map(item => (
                                        <li key={item.definitionId} className={ROW}>
                                            <ProductIcon type={item.type as ProductKind} name={item.name} />
                                            <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.name}</span>
                                            {item.inRooms > 0 && <Badge>{item.inRooms} placed</Badge>}
                                            <span className="w-12 text-right font-mono text-sm tabular-nums">{item.inInventory > 0 ? `×${item.inInventory}` : ''}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                </Panel>

                <Panel
                    title={`Badges (${inventory.badges.length.toLocaleString()})`}
                    actions={(
                        <>
                            {inventory.badges.length > 0 && (
                                <SearchInput value={badgeFilter} onValueChange={setBadgeFilter} placeholder="Code" aria-label="Filter badges" className="w-36" />
                            )}
                            {can?.giveBadge && <Button variant="secondary" icon={<Plus />} onClick={() => setAdding('badge')}>Add</Button>}
                        </>
                    )}
                >
                    {badges.length === 0
                        ? <EmptyState>{inventory.badges.length === 0 ? 'No badges.' : 'No badge matches.'}</EmptyState>
                        : (
                                // Each tile ruled on its right and bottom, the outer edges clipped: a short last row ends clean.
                                <div className="max-h-[36rem] overflow-hidden overflow-y-auto rounded-b-xl">
                                    <ul className="-mr-px -mb-px grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))]">
                                        {badges.map(badge => (
                                            <li key={badge.code} className="group flex min-h-12 items-center gap-2 border-r border-b border-line px-3 py-2">
                                                <ProductIcon type="badge" name={badge.code} />
                                                <span className="min-w-0 flex-1 truncate font-mono text-xs" title={badge.code}>{badge.code}</span>
                                                {badge.slot !== null && <Badge tone="accent">#{badge.slot}</Badge>}
                                                {can?.takeBadge && (
                                                    // Shown on hover from a tablet up; always on a phone, which has none.
                                                    <IconButton
                                                        small
                                                        tone="bad"
                                                        icon={<X />}
                                                        label={`Take ${badge.code}`}
                                                        disabled={action.busy}
                                                        onClick={() => action.run({ action: 'takebadge', badge: badge.code }, { title: `Take the badge ${badge.code} from ${player.name}?`, confirm: 'Take badge' })}
                                                        className="-mr-1.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                                                    />
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                </Panel>
            </div>

            {addsFurniture && (
                <FurnitureSheet player={player} action={action} open={adding === 'furniture'} onClose={() => setAdding(null)} canGive={can.giveItem} canGift={can.gift} />
            )}
            {can?.giveBadge && <BadgeSheet player={player} action={action} open={adding === 'badge'} onClose={() => setAdding(null)} />}
        </div>
    );
};
