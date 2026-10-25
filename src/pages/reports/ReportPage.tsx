import { Hand, MessagesSquare, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';

import { useMe } from '#/api/queries';
import { type CloseReason, type ReportDetailResponse, type ReportHistory, type ReportItem, useReport, useReportAction } from '#/api/reports';
import { ask } from '#/components/confirm';
import { PhoneLabel, Row, RowList, SortedRowList } from '#/components/RowList';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, Checkbox, EmptyState, ErrorNotice, Kv, Loading, PageBody, PageHeader, Panel, TextLink } from '#/components/ui';
import { cx } from '#/lib/cx';
import { plural } from '#/lib/plural';
import type { SortKeys } from '#/lib/sort';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

import { CLOSE_REASONS, sanctionLabel, SOURCES } from './labels';
import { PlayerLink, StateBadge } from './parts';

/** The other open reports, sorted as the reports list sorts them: open before picked before closed. */
const RELATED_KEYS: SortKeys<ReportItem> = {
    sent: x => Date.parse(x.atUtc),
    topic: x => x.topic,
    from: x => x.reporterName,
    state: x => ({ open: 0, picked: 1, closed: 2 })[x.state],
};

/** A chat line's time of day: the lines of one report are minutes apart. */
const timeOf = (utc: string) => new Date(utc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const APPEALS: Record<ReportDetailResponse['appeal'], string | null> = {
    none: null,
    appealed: 'Appealed, waiting',
    upheld: 'Appealed, upheld',
    dismissed: 'Appealed, dismissed',
};

/** A player's reports so far, in a line. */
const History = ({ label, history, sent }: { label: string; history: ReportHistory; sent?: boolean }) => (
    <Kv label={label}>
        {history.total === 0
            ? <span className="text-muted">none</span>
            : (
                    <span className="inline-flex flex-wrap justify-end gap-1">
                        <span>{plural(history.total, sent ? 'sent' : 'report', sent ? 'sent' : 'reports')}</span>
                        {history.sanctioned > 0 && <Badge tone="red">{history.sanctioned} sanctioned</Badge>}
                        {history.abusive > 0 && <Badge tone="amber">{history.abusive} abusive</Badge>}
                        {history.useless > 0 && <Badge>{history.useless} useless</Badge>}
                    </span>
                )}
    </Kv>
);

/** Closing it: resolved (with the default sanction, when there is one), useless or abusive. */
const CloseActions = ({ detail, busy, onClose }: { detail: ReportDetailResponse; busy: boolean; onClose: (reason: CloseReason, sanction: boolean, withRelated: boolean) => void }) => {
    const [ withRelated, setWithRelated ] = useState(false);
    const { report, defaultSanction, related } = detail;
    const about = report.reportedName ?? (report.reportedId !== null ? `player #${report.reportedId}` : null);
    const count = 1 + (withRelated ? related.length : 0);
    const these = count === 1 ? 'the report' : `these ${count} reports`;

    return (
        <Panel title="Close it" description="The sender is told how it was closed, as the client's mod tool tells them.">
            <div className="flex flex-col gap-3 p-4">
                {related.length > 0 && (
                    <Checkbox
                        label={`Close the ${plural(related.length, 'other open report')} about ${about} with it`}
                        checked={withRelated}
                        onChange={setWithRelated}
                    />
                )}
                <div className="flex flex-wrap gap-2">
                    {defaultSanction && about && (
                        <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() => ask(
                                {
                                    title: `Give ${about} ${sanctionLabel(defaultSanction)}?`,
                                    body: `Closes ${these} as resolved and gives ${about} the next sanction of the hotel's ladder, as "close with default sanction" in the mod tool does.`,
                                    confirm: 'Sanction and close',
                                    danger: true,
                                },
                                () => onClose('resolved', true, withRelated),
                            )}
                        >
                            Resolve with {sanctionLabel(defaultSanction)}
                        </Button>
                    )}
                    <Button disabled={busy} onClick={() => onClose('resolved', false, withRelated)}>Resolve</Button>
                    <Button variant="secondary" disabled={busy} onClick={() => onClose('useless', false, withRelated)}>Useless</Button>
                    <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => ask(
                            { title: `Close ${these} as abusive?`, body: 'For a report sent to waste moderators\' time. It counts against the sender\'s history.', confirm: 'Close as abusive' },
                            () => onClose('abusive', false, withRelated),
                        )}
                    >
                        Abusive
                    </Button>
                </div>
            </div>
        </Panel>
    );
};

/**
 * One call for help: what the sender wrote and the chat they sent with it, the reported player's
 * lines marked; who they are and their histories; and picking, letting go and closing it, which
 * are the client's mod tool's own, so moderators in the hotel see it at once.
 */
export const ReportPage = () => {
    const id = Number(useParams().id);
    const me = useMe().data;
    const report = useReport(id);
    const action = useReportAction(id);
    const detail = report.data;
    const linked = me?.canViewPlayers ?? false;

    const run = (kind: 'pick' | 'release', done: string) =>
        action.mutate({ kind }, { onSuccess: () => toast(done), onError: toastError });

    const close = (reason: CloseReason, sanction: boolean, withRelated: boolean) =>
        action.mutate(
            { kind: 'close', request: { reason, sanction, withRelated } },
            {
                onSuccess: (closed) => {
                    if (sanction && !closed.report.sanctioned)
                        toastError(new Error('Closed, but the sanction was refused: the player may be staff, or you may not give it.'));
                    else
                        toast(`Closed as ${CLOSE_REASONS[reason].toLowerCase()}`);
                },
                onError: toastError,
            },
        );

    const item = detail?.report;
    const mine = item?.state === 'picked' && item.pickerId === me?.id;
    const theirs = item?.state === 'picked' && !mine;

    return (
        <>
            <PageHeader
                title={item ? item.topic : `Report #${id}`}
                description={item ? `Report #${item.id}, sent ${fromNow(item.atUtc)}` : undefined}
                back={{ to: '/reports', label: 'Reports' }}
            >
                {item && <StateBadge report={item} me={me?.id} />}
                {item?.state === 'open' && <Button icon={<Hand />} disabled={action.isPending} onClick={() => run('pick', 'Picked: it\'s yours')}>Pick</Button>}
                {mine && <Button variant="secondary" icon={<Undo2 />} disabled={action.isPending} onClick={() => run('release', 'Let go')}>Let go</Button>}
            </PageHeader>
            <PageBody>
                {report.error && <ErrorNotice error={report.error} />}
                {report.isPending && <Loading />}
                {detail && item && (
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="flex min-w-0 flex-col gap-4">
                            <Panel title="What they wrote">
                                <p className="px-4 py-3 text-sm whitespace-pre-wrap wrap-anywhere">{item.message || <span className="text-muted">Nothing: only the topic.</span>}</p>
                            </Panel>

                            <Panel
                                className="overflow-clip"
                                title={item.source === 'im' ? 'The conversation sent with it' : 'The chat sent with it'}
                                description={item.reportedId !== null ? `${item.reportedName ?? 'The reported player'}'s lines are marked.` : undefined}
                                actions={item.roomId !== null && me?.canViewChatlog
                                    ? <TextLink to={`/chatlog?room=${item.roomId}`}><MessagesSquare className="mr-1 inline size-4" />Room chat</TextLink>
                                    : undefined}
                            >
                                {detail.lines.length === 0
                                    ? <EmptyState>No chat came with it.</EmptyState>
                                    : (
                                            <RowList columns="max-content minmax(0,9rem) minmax(0,1fr)" headers={[ { label: 'When' }, { label: 'Who' }, { label: 'Said' } ]}>
                                                {detail.lines.map((line, index) => (
                                                    <Row key={index} className={cx(line.reported && 'bg-red-500/8 hover:bg-red-500/12')}>
                                                        <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(line.atUtc)}>{timeOf(line.atUtc)}</span>
                                                        <span className="truncate"><PlayerLink id={line.playerId} name={line.playerName} linked={linked} /></span>
                                                        <span className="basis-full wrap-anywhere sm:basis-auto">{line.text}</span>
                                                    </Row>
                                                ))}
                                            </RowList>
                                        )}
                            </Panel>

                            {item.state !== 'closed' && !theirs && <CloseActions detail={detail} busy={action.isPending} onClose={close} />}
                            {theirs && (
                                <Panel title="Another moderator has it">
                                    <p className="px-4 py-3 text-sm text-muted">
                                        {item.pickerName ?? `Moderator #${item.pickerId}`} picked it. Only they can close it or let it go, here or in the hotel.
                                    </p>
                                </Panel>
                            )}

                            {detail.related.length > 0 && (
                                <Panel className="overflow-clip" title={`Other open reports about ${item.reportedName ?? 'them'}`}>
                                    <SortedRowList
                                        columns="max-content minmax(0,1fr) minmax(0,9rem) max-content"
                                        headers={[ { label: 'Sent', sort: 'sent', first: 'desc' }, { label: 'Topic', sort: 'topic' }, { label: 'From', sort: 'from' }, { label: 'State', sort: 'state' } ]}
                                        rows={detail.related}
                                        keys={RELATED_KEYS}
                                        initial={{ sort: 'sent', dir: 'desc' }}
                                    >
                                        {other => (
                                            <Row key={other.id}>
                                                <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(other.atUtc)}>{fromNow(other.atUtc)}</span>
                                                <Link to={`/reports/${other.id}`} className="truncate font-medium hover:text-accent">{other.topic}</Link>
                                                <span className="truncate"><PhoneLabel>from </PhoneLabel><PlayerLink id={other.reporterId} name={other.reporterName} linked={linked} /></span>
                                                <span className="max-sm:ml-auto"><StateBadge report={other} me={me?.id} /></span>
                                            </Row>
                                        )}
                                    </SortedRowList>
                                </Panel>
                            )}
                        </div>

                        <div className="flex min-w-0 flex-col gap-4">
                            <Panel title="Details">
                                <dl>
                                    <Kv label="Sent">{formatDateTime(item.atUtc)}</Kv>
                                    <Kv label="From">{SOURCES[item.source]}</Kv>
                                    {item.category && <Kv label="Category">{item.category}</Kv>}
                                    <Kv label="Sender"><PlayerLink id={item.reporterId} name={item.reporterName} linked={linked} /></Kv>
                                    <Kv label="About">
                                        {item.reportedId !== null
                                            ? <PlayerLink id={item.reportedId} name={item.reportedName} linked={linked} />
                                            : <span className="text-muted">no player</span>}
                                    </Kv>
                                    {item.roomId !== null && (
                                        <Kv label="Room">
                                            {me?.canViewRooms
                                                ? <Link to={`/rooms/${item.roomId}`} className="hover:text-accent">{item.roomName ?? `room #${item.roomId}`}</Link>
                                                : (item.roomName ?? `room #${item.roomId}`)}
                                        </Kv>
                                    )}
                                    {detail.groupId !== null && <Kv label="Group">{detail.groupName ?? `group #${detail.groupId}`}{detail.forumThreadId !== null ? `, thread ${detail.forumThreadId}` : ''}{detail.forumMessageId !== null ? `, message ${detail.forumMessageId}` : ''}</Kv>}
                                    {detail.photoId && <Kv label="Photo" mono>{detail.photoId}</Kv>}
                                    {detail.givenName && <Kv label="Name given">{detail.givenName}</Kv>}
                                    {detail.givenEmail && <Kv label="Email given">{detail.givenEmail}</Kv>}
                                    {item.pickerId !== null && <Kv label="Picked by"><PlayerLink id={item.pickerId} name={item.pickerName} linked={linked} /></Kv>}
                                    {item.closedAtUtc && <Kv label="Closed">{formatDateTime(item.closedAtUtc)}{item.closeReason ? `, ${CLOSE_REASONS[item.closeReason].toLowerCase()}` : ''}{item.sanctioned ? ', sanctioned' : ''}</Kv>}
                                    {APPEALS[detail.appeal] && <Kv label="Appeal">{APPEALS[detail.appeal]}</Kv>}
                                </dl>
                            </Panel>

                            <Panel title="History" description="Every report so far, this one included.">
                                <dl>
                                    {detail.aboutReported && <History label={`About ${item.reportedName ?? 'them'}`} history={detail.aboutReported} />}
                                    <History label={`Sent by ${item.reporterName ?? 'the sender'}`} history={detail.bySender} sent />
                                    {detail.defaultSanction && item.reportedId !== null && <Kv label="Next sanction">{sanctionLabel(detail.defaultSanction)}</Kv>}
                                </dl>
                                {item.reportedId !== null && (
                                    <div className="border-t border-line px-4 py-2.5 text-[13px]">
                                        <TextLink to={`/reports?state=all&player=${item.reportedId}`}>Every report by or about {item.reportedName ?? 'them'}</TextLink>
                                    </div>
                                )}
                            </Panel>
                        </div>
                    </div>
                )}
            </PageBody>
        </>
    );
};
