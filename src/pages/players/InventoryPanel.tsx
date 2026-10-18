import { Link } from 'react-router';

import type { ProductKind } from '#/api/catalog';
import { type PlayerDetailResponse, usePlayerInventory, usePlayerVisits } from '#/api/players';
import { useMe } from '#/api/queries';
import { TabbedPanel } from '#/components/TabbedPanel';
import { Badge, EmptyState, ErrorNotice, Loading } from '#/components/ui';
import { fromNow } from '#/lib/time';
import { ProductIcon } from '#/pages/catalog/ProductIcon';
import { formatDateTime } from '#/pages/rooms/labels';

const ROW = 'flex min-h-12 items-center gap-3 px-4 py-2';
const ITEM = 'border-t border-line first:border-t-0';

/** The rooms a player went into, newest first, each a way to the room when you may look at rooms. */
const Visits = ({ playerId }: { playerId: number }) => {
    const { data: visits, error, isPending } = usePlayerVisits(playerId);
    const canViewRooms = useMe().data?.canViewRooms ?? false;

    if (isPending)
        return <Loading />;

    if (error)
        return <div className="p-4"><ErrorNotice error={error} /></div>;

    if (visits.length === 0)
        return <EmptyState>Hasn&apos;t gone into any room.</EmptyState>;

    return (
        <ul>
            {visits.map((visit, index) => {
                const content = (
                    <>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{visit.roomName || `Room #${visit.roomId}`}</span>
                        <span className="text-xs text-muted" title={formatDateTime(visit.enteredUtc)}>{fromNow(visit.enteredUtc)}</span>
                    </>
                );

                return (
                    <li key={index} className={ITEM}>
                        {canViewRooms
                            ? <Link to={`/rooms/${visit.roomId}`} className={`${ROW} hover:bg-subtle/60`}>{content}</Link>
                            : <div className={ROW}>{content}</div>}
                    </li>
                );
            })}
        </ul>
    );
};

/**
 * What a player owns and where they've been: their badges (worn ones first, with their slot),
 * their furniture by kind with how many are in their inventory and how many placed in rooms, and
 * the rooms they went into lately. Read-only; giving and taking is in the player's actions.
 */
export const InventoryPanel = ({ player }: { player: PlayerDetailResponse }) => {
    const { data: inventory, error, isPending } = usePlayerInventory(player.id);

    const loading = isPending ? <Loading /> : error ? <div className="p-4"><ErrorNotice error={error} /></div> : null;

    return (
        <TabbedPanel
            tabs={[
                {
                    id: 'badges',
                    label: 'Badges',
                    count: inventory?.badges.length,
                    content: loading ?? (inventory && (inventory.badges.length === 0
                        ? <EmptyState>No badges.</EmptyState>
                        : (
                                // Each tile ruled on its right and bottom, the outer edges clipped: a short last row ends clean.
                                <div className="overflow-hidden rounded-b-xl">
                                    <ul className="-mr-px -mb-px grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))]">
                                        {inventory.badges.map(badge => (
                                            <li key={badge.code} className="flex min-h-12 items-center gap-2 border-r border-b border-line px-3 py-2">
                                                <ProductIcon type="badge" name={badge.code} />
                                                <span className="min-w-0 flex-1 truncate font-mono text-xs">{badge.code}</span>
                                                {badge.slot !== null && <Badge tone="accent">#{badge.slot}</Badge>}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))),
                },
                {
                    id: 'furniture',
                    label: 'Furniture',
                    count: inventory ? inventory.furnitureInInventory + inventory.furnitureInRooms : undefined,
                    content: loading ?? (inventory && (
                        <>
                            <p className="border-b border-line px-4 py-2.5 font-mono text-[11px] text-muted">
                                {inventory.furnitureInInventory.toLocaleString()} in inventory · {inventory.furnitureInRooms.toLocaleString()} placed · {inventory.pets} pets · {inventory.bots} bots
                            </p>
                            {inventory.furniture.length === 0
                                ? <EmptyState>No furniture.</EmptyState>
                                : (
                                        <ul className="max-h-[28rem] overflow-y-auto">
                                            {inventory.furniture.map(item => (
                                                <li key={item.definitionId} className={`${ITEM} ${ROW}`}>
                                                    <ProductIcon type={item.type as ProductKind} name={item.name} />
                                                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{item.name}</span>
                                                    {item.inRooms > 0 && <Badge>{item.inRooms} placed</Badge>}
                                                    <span className="w-12 text-right font-mono text-sm tabular-nums">{item.inInventory > 0 ? `×${item.inInventory}` : ''}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                        </>
                    )),
                },
                { id: 'visits', label: 'Room visits', content: <Visits playerId={player.id} /> },
            ]}
        />
    );
};
