import { House, Settings } from 'lucide-react';
import type { ReactNode } from 'react';

import type { RoomDetailResponse } from '#/api/types';
import type { TabItem } from '#/components/Tabs';
import { ErrorNotice, LiveBadge, PageHeader, SuccessNotice } from '#/components/ui';
import { useRememberRecent } from '#/lib/recent';

import { doorModeLabel } from './labels';

/**
 * The header of a room's pages: its name, the facts that identify it, whether it is live, and its
 * tabs. Settings is a tab only for staff who may change them.
 */
export const RoomHeader = ({ id, room, tab, children }: { id: number; room: RoomDetailResponse | undefined; tab: 'overview' | 'settings'; children?: ReactNode }) => {
    useRememberRecent('room', id, room?.name);

    const tabs: TabItem[] = [
        { value: 'overview', label: 'Overview', icon: <House />, to: `/rooms/${id}/overview` },
        ...(room?.can.editSettings ? [ { value: 'settings', label: 'Settings', icon: <Settings />, to: `/rooms/${id}/settings` } ] : []),
    ];

    return (
        <PageHeader
            title={room?.name ?? `Room #${id}`}
            back={{ to: '/rooms', label: 'Rooms' }}
            tabs={{ items: tabs, value: tab }}
            description={room && [
                `#${room.id}`,
                `owner ${room.ownerName}`,
                room.categoryName,
                `${doorModeLabel(room.doorMode).toLowerCase()} door`,
            ].filter(Boolean).join(' · ')}
        >
            {room && (
                <LiveBadge live={room.isLoaded}>
                    {room.isLoaded ? `LIVE · ${room.playersInside.length}/${room.playersMax}` : 'NOT LOADED'}
                </LiveBadge>
            )}
            {children}
        </PageHeader>
    );
};

/** The answer to the last action on the room: its sentence, or why it was refused. */
export const ActionOutcome = ({ message, error }: { message: string | undefined; error: unknown }) => {
    if (error)
        return <ErrorNotice error={error} />;

    return message ? <SuccessNotice>{message}</SuccessNotice> : null;
};
