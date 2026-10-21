import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge, EmptyState, IconButton, Switch, Td, Th } from '#/components/ui';

import { AUDIENCE_OPTIONS, CONDITION_REWARD_TRACK, DEFAULT_COLOR, type HabboStatus, hiddenReason, type Notice, NOTICE_TYPES, parseColor, splitCondition } from './model';
import { NoticePreview } from './NoticePreview';

const HABBO_BADGE: Record<HabboStatus, ReactNode> = {
    same: <Badge>same as Habbo</Badge>,
    differs: <Badge tone="amber">differs from Habbo</Badge>,
    ours: <Badge>not on Habbo</Badge>,
};

/** From when to when it shows, as the variables write the server's time. */
const When = ({ notice }: { notice: Notice }) => {
    const { show_from: from, expiry } = notice.fields;

    if (!from && !expiry) return <span className="text-xs text-muted">Always</span>;

    return (
        <span className="flex flex-col font-mono text-xs whitespace-nowrap">
            <span>{from || 'now'}</span>
            <span><span className="text-muted">→</span> {expiry || 'no end'}</span>
        </span>
    );
};

/** Who it shows to, and while what. */
const Who = ({ notice }: { notice: Notice }) => {
    const condition = splitCondition(notice.fields.condition);

    return (
        <span className="flex flex-col text-xs">
            <span>{AUDIENCE_OPTIONS.find(x => x.value === notice.fields.audience)?.label ?? notice.fields.audience}</span>
            {condition.kind === CONDITION_REWARD_TRACK && <span className="text-muted">until <span className="font-mono">{condition.arg}</span> is done</span>}
            {notice.fields.condition && condition.kind !== CONDITION_REWARD_TRACK && <span className="font-mono text-muted">{notice.fields.condition}</span>}
        </span>
    );
};

/**
 * Notices as rows, each opening its own editor: as the column docks them, and where each stands
 * (unsaved, new, out of its dates, without words, against Habbo's). `ordered`, the shown ones,
 * with arrows to move one; the switch shows or hides one.
 */
export const NoticeTable = ({ notices, ordered, empty, dirty, isNew, habboOf, disabled, onOpen, onMove, onShow }: {
    notices: Notice[];
    ordered: boolean;
    empty: string;
    dirty: (key: string) => boolean;
    isNew: (key: string) => boolean;
    habboOf: (notice: Notice) => HabboStatus | null;
    disabled: boolean;
    onOpen: (key: string) => void;
    onMove: (key: string, by: number) => void;
    onShow: (key: string, show: boolean) => void;
}) => {
    if (notices.length === 0) return <EmptyState>{empty}</EmptyState>;

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr>
                        {ordered && <Th className="w-0">Order</Th>}
                        <Th className="w-0">Notice</Th>
                        <Th>Style</Th>
                        <Th>Click opens</Th>
                        <Th>When (server time)</Th>
                        <Th>Who sees it</Th>
                        <Th className="w-0">Shown</Th>
                    </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0" data-testid={ordered ? 'shown-notices' : 'hidden-notices'}>
                    {notices.map((notice, index) => {
                        const hidden = hiddenReason(notice);
                        const habbo = habboOf(notice);
                        const link = notice.fields.internal_link || notice.fields.external_link;

                        return (
                            <tr key={notice.key} onClick={() => onOpen(notice.key)} className="cursor-pointer hover:bg-subtle/60">
                                {ordered && (
                                    <Td>
                                        {/* The row's click opens the notice: these keep theirs. */}
                                        <span className="flex items-center gap-0.5" onClick={event => event.stopPropagation()}>
                                            <span className="w-6 font-mono text-xs text-muted tabular-nums">#{index + 1}</span>
                                            <IconButton small label={`Move ${notice.key} up`} icon={<ArrowUp />} disabled={disabled || index === 0} onClick={() => onMove(notice.key, -1)} />
                                            <IconButton small label={`Move ${notice.key} down`} icon={<ArrowDown />} disabled={disabled || index === notices.length - 1} onClick={() => onMove(notice.key, 1)} />
                                        </span>
                                    </Td>
                                )}
                                <Td>
                                    {/* A button for the keyboard: its click goes on to the row's. */}
                                    <button type="button" aria-label={`Edit ${notice.key}`} className="flex w-48 flex-col items-start gap-1.5 rounded text-left">
                                        <NoticePreview notice={notice} />
                                        <span className="font-mono text-xs break-all">{notice.key}</span>
                                        <span className="flex flex-wrap gap-1">
                                            {isNew(notice.key) && <Badge tone="accent">new</Badge>}
                                            {dirty(notice.key) && <Badge tone="accent">unsaved</Badge>}
                                            {hidden === 'expired' && <Badge tone="amber">expired</Badge>}
                                            {hidden === 'not yet' && <Badge tone="amber">not yet</Badge>}
                                            {!notice.texts.desc && <Badge tone="amber">no words</Badge>}
                                            {habbo && HABBO_BADGE[habbo]}
                                        </span>
                                    </button>
                                </Td>
                                <Td>
                                    <span className="flex items-center gap-2 text-xs whitespace-nowrap">
                                        <span className="size-3.5 shrink-0 rounded border border-black/10" style={{ background: parseColor(notice.fields.color) ?? DEFAULT_COLOR }} />
                                        {NOTICE_TYPES.find(x => x.value === (notice.fields.type || 'normal'))?.label ?? notice.fields.type}
                                    </span>
                                </Td>
                                <Td>{link ? <span className="block max-w-48 truncate font-mono text-xs" title={link}>{link}</span> : <span className="text-xs text-muted">Nothing</span>}</Td>
                                <Td><When notice={notice} /></Td>
                                <Td><Who notice={notice} /></Td>
                                <Td>
                                    <span onClick={event => event.stopPropagation()}>
                                        <Switch label={<span className="sr-only">{`${notice.key} shown`}</span>} checked={ordered} disabled={disabled} onChange={show => onShow(notice.key, show)} />
                                    </span>
                                </Td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};
