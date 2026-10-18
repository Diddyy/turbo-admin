import { Bell, CalendarClock, CheckCheck, Gavel, ShieldAlert } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { type NotificationItem, useNotifications, useSeenNotifications } from '#/api/notifications';
import { ErrorNotice, Label, Loading } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';

/** Each kind's icon and colour, and where picking one goes. */
const KINDS: Record<string, { icon: ReactNode; tone: string; to: (item: NotificationItem) => string }> = {
    availability: { icon: <CalendarClock />, tone: 'bg-warn-soft text-warn', to: () => '/' },
    ban: { icon: <Gavel />, tone: 'bg-bad-soft text-bad', to: item => (item.playerId ? `/players/${item.playerId}` : '/players') },
    refusedCommand: {
        icon: <ShieldAlert />,
        tone: 'bg-accent-soft text-accent',
        // Refused for a permission or for room rights: the player's log shows both.
        to: item => `/command-log?${new URLSearchParams(item.playerId ? { player: String(item.playerId) } : { source: 'console' })}`,
    },
};

const FALLBACK = KINDS.refusedCommand!;

/**
 * The bell in every page's header: what staff should know of lately (maintenance or a shutdown,
 * the week's bans, commands refused), with how many this browser has not seen. The live stream
 * asks again the moment a ban or maintenance happens. Picking one opens what it is about; "Mark
 * all read" clears the count.
 */
export const NotificationsBell = () => {
    const navigate = useNavigate();
    const { data, error } = useNotifications();
    const seen = useSeenNotifications(state => state.seen);
    const markSeen = useSeenNotifications(state => state.markSeen);
    const [ open, setOpen ] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const items = data?.items ?? [];
    const unread = items.filter(item => !seen.includes(item.id)).length;

    useEffect(() => {
        if (!open)
            return;

        const away = (event: MouseEvent) => {
            if (!box.current?.contains(event.target as Node))
                setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setOpen(false);
        };

        document.addEventListener('mousedown', away);
        window.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', away);
            window.removeEventListener('keydown', onKey);
        };
    }, [ open ]);

    const pick = (item: NotificationItem) => {
        markSeen([ item.id ]);
        setOpen(false);
        navigate((KINDS[item.kind] ?? FALLBACK).to(item));
    };

    return (
        <div ref={box} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                title={unread ? `${unread} new` : 'Notifications'}
                aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}
                className={cx('relative grid size-10 place-items-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink lg:size-9 [&>svg]:size-5 lg:[&>svg]:size-[18px]', open && 'bg-subtle text-ink')}
            >
                <Bell />
                {unread > 0 && (
                    <span className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 font-mono text-[10px] leading-none font-semibold text-white">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>
            {open && (
                <div className="fixed inset-x-2 top-16 z-40 animate-rise rounded-xl border border-line bg-surface shadow-xl sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-[24rem]">
                    <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                        <Label>Notifications</Label>
                        {unread > 0 && (
                            <button
                                type="button"
                                onClick={() => markSeen(items.map(item => item.id))}
                                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted hover:bg-subtle hover:text-ink [&>svg]:size-3.5"
                            >
                                <CheckCheck />
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="max-h-[min(28rem,70dvh)] overflow-y-auto overscroll-contain p-1.5">
                        {error && <div className="p-1.5"><ErrorNotice error={error} /></div>}
                        {!error && !data && <Loading />}
                        {data && items.length === 0 && (
                            <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                                <Bell className="size-6 text-muted" />
                                <span className="text-sm font-medium">Nothing new</span>
                                <span className="text-xs text-muted">Maintenance, bans and refused commands from the last week show here.</span>
                            </div>
                        )}
                        {items.map((item) => {
                            const kind = KINDS[item.kind] ?? FALLBACK;
                            const fresh = !seen.includes(item.id);

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => pick(item)}
                                    className={cx('flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-subtle', fresh && 'bg-accent-soft/40')}
                                >
                                    <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full [&>svg]:size-3.5', kind.tone)}>{kind.icon}</span>
                                    <span className="min-w-0 flex-1">
                                        <span className="block text-sm leading-snug">{item.title}</span>
                                        {item.detail && <span className="mt-0.5 line-clamp-2 block font-mono text-xs break-words text-muted">{item.detail}</span>}
                                        <span className="mt-0.5 block text-[11px] text-muted" title={new Date(item.atUtc).toLocaleString()}>{fromNow(item.atUtc)}</span>
                                    </span>
                                    {fresh && <span aria-label="New" className="mt-2 size-2 shrink-0 rounded-full bg-accent" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
