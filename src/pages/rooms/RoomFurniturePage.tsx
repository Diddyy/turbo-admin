import { Box, ChevronDown, LogOut } from 'lucide-react';
import { useDeferredValue, useState } from 'react';
import { Link, useParams } from 'react-router';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import { useMe, useRoom } from '#/api/queries';
import { roomCalls, type RoomFurnitureItem, useRoomAction, useRoomFurniture } from '#/api/rooms';
import { ask } from '#/components/confirm';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageBody, Panel } from '#/components/ui';
import { cx } from '#/lib/cx';

import { ActionOutcome, RoomHeader } from './RoomHeader';

const Icon = ({ className }: { className: string }) => {
    const assets = useClientAssets();
    const url = furniIconUrl(assets, className);
    const [ failed, setFailed ] = useState<string | null>(null);

    return (
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-subtle">
            {url && failed !== url
                ? <img key={url} src={url} alt="" loading="lazy" className="max-h-[85%] max-w-[85%] [image-rendering:pixelated]" onError={() => setFailed(url)} />
                : <Box className="size-4 text-muted" aria-hidden />}
        </span>
    );
};

/** Its data as the room keeps it: JSON laid out to read, anything else as it is. */
const readable = (data: string) => {
    try {
        return JSON.stringify(JSON.parse(data), null, 2);
    } catch {
        return data;
    }
};

/** One item: what it is, whose, where; opened, its data and a way to take it out of the room. */
const ItemRow = ({ item, open, onToggle, canPickUp, linkPlayers, onPickUp, picking }: {
    item: RoomFurnitureItem;
    open: boolean;
    onToggle: () => void;
    canPickUp: boolean;
    linkPlayers: boolean;
    onPickUp: () => void;
    picking: boolean;
}) => (
    <li className="border-t border-line first:border-t-0">
        <button type="button" onClick={onToggle} aria-expanded={open} className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-subtle/60', open && 'bg-subtle/40')}>
            <Icon className={item.className} />
            <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline gap-2">
                    <span className="truncate font-mono text-[13px] font-medium">{item.className}</span>
                    <span className="truncate text-sm text-muted max-sm:hidden">{item.name}</span>
                </span>
                <span className="block truncate text-xs text-muted">{`#${item.id} · ${item.ownerName}`}</span>
            </span>
            <span className="hidden w-40 shrink-0 truncate font-mono text-[11px] text-muted md:block" title={item.logic}>{item.logic}</span>
            <span className="hidden w-32 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums sm:block">
                {item.wall ? <Badge>wall</Badge> : `${item.x}, ${item.y}, ${item.z.toFixed(2)} · ${item.rotation}`}
            </span>
            <ChevronDown className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
        </button>
        {open && (
            <div className="flex flex-col gap-3 border-t border-line bg-canvas/50 px-4 py-3 text-[13px]">
                <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    <div className="flex justify-between gap-3"><dt className="text-muted">Owner</dt><dd>{linkPlayers ? <Link to={`/players/${item.ownerId}`} className="text-accent hover:underline">{item.ownerName}</Link> : item.ownerName}</dd></div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-muted">Definition</dt>
                        <dd><Link to={`/gamedata/library/furniture?q=${encodeURIComponent(item.className)}&id=${item.definitionId}`} className="font-mono text-accent hover:underline">{`${item.className} (sprite ${item.spriteId})`}</Link></dd>
                    </div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Logic</dt><dd className="font-mono">{item.logic}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted">Where</dt><dd className="font-mono">{item.wall ? 'on the wall' : `x ${item.x}, y ${item.y}, z ${item.z.toFixed(2)}, rotation ${item.rotation}`}</dd></div>
                </dl>
                <div>
                    <span className="text-xs font-medium text-muted">Data</span>
                    <pre className="mt-1 max-h-60 overflow-auto rounded-lg border border-line bg-surface p-2.5 font-mono text-[11px] whitespace-pre-wrap">{item.extraData ? readable(item.extraData) : '(none)'}</pre>
                </div>
                {canPickUp && (
                    <div>
                        <Button variant="secondary" icon={<LogOut />} disabled={picking} onClick={onPickUp}>Take out of the room</Button>
                    </div>
                )}
            </div>
        )}
    </li>
);

/**
 * The furniture in a room: found by its classname, name, owner or id; each opened to read its
 * data, and taken back to its owner's inventory by staff who may pick up any furniture.
 */
export const RoomFurniturePage = () => {
    const id = Number(useParams().id);
    const { data: room } = useRoom(id);
    const { data: items, error, isPending } = useRoomFurniture(id);
    const [ text, setText ] = useState('');
    const [ open, setOpen ] = useState<number | null>(null);
    const action = useRoomAction(id);
    const calls = roomCalls(id);
    const linkPlayers = useMe().data?.canViewPlayers ?? false;
    const canPickUp = room?.can.pickUpFurni ?? false;
    const words = useDeferredValue(text.trim().toLowerCase());
    const shown = items?.filter(x => !words
        || x.className.toLowerCase().includes(words)
        || (x.name ?? '').toLowerCase().includes(words)
        || x.ownerName.toLowerCase().includes(words)
        || String(x.id) === words) ?? [];

    return (
        <>
            <RoomHeader id={id} room={room} tab="furniture" />
            <PageBody className="flex flex-col gap-4">
                <ActionOutcome message={action.data?.message} error={action.error} />
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                {items && (
                    <Panel
                        title={`Furniture (${items.length})`}
                        actions={<SearchInput value={text} onValueChange={setText} placeholder="Classname, name, owner or id" aria-label="Find furniture" className="w-full sm:w-72" />}
                        className="overflow-clip"
                    >
                        {shown.length === 0
                            ? <EmptyState>{items.length === 0 ? 'No furniture stands in this room.' : 'No furniture in it is like that.'}</EmptyState>
                            : (
                                    <ul>
                                        {shown.map(item => (
                                            <ItemRow
                                                key={item.id}
                                                item={item}
                                                open={open === item.id}
                                                onToggle={() => setOpen(open === item.id ? null : item.id)}
                                                canPickUp={canPickUp}
                                                linkPlayers={linkPlayers}
                                                picking={action.isPending}
                                                onPickUp={() => ask(
                                                    { title: `Take ${item.className} out of the room, back to ${item.ownerName}'s inventory?`, confirm: 'Take out', danger: false },
                                                    () => action.mutate(() => calls.pickupFurniture(item.id)),
                                                )}
                                            />
                                        ))}
                                    </ul>
                                )}
                    </Panel>
                )}
            </PageBody>
        </>
    );
};
