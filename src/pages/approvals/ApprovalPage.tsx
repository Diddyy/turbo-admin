import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';

import { type ApprovalItem, useApproval, useApprovalDecision } from '#/api/approvals';
import { useMe } from '#/api/queries';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Button, ErrorNotice, Kv, Labeled, Loading, PageBody, PageHeader, Panel, Textarea } from '#/components/ui';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

import { ApprovalBadge, Decider, Requester } from './parts';

/** Why the viewer can't decide a pending request. */
const whyNot = (approval: ApprovalItem) =>
    approval.own
        ? 'You asked for this, or it was asked for you: someone else decides it.'
        : `Deciding it needs ${approval.node}, which you don't hold.`;

/** Approving or denying it, with a note kept beside the decision. */
const Decide = ({ approval }: { approval: ApprovalItem }) => {
    const [ note, setNote ] = useState('');
    const decision = useApprovalDecision(approval.id);

    const decide = (approve: boolean) =>
        decision.mutate(
            { approve, note },
            {
                onSuccess: (answer) => {
                    if (answer.ok)
                        toast(answer.message);
                    else
                        toastError(new Error(answer.message));
                },
                onError: toastError,
            },
        );

    return (
        <Panel title="Decide" description="Approving carries it out at once, once, whoever else presses approve.">
            <div className="flex flex-col gap-3 p-4">
                <Labeled label="Note" hint="Kept with your decision, for whoever reads it later.">
                    <Textarea value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={2} />
                </Labeled>
                <div className="flex flex-wrap gap-2">
                    <Button
                        icon={<Check />}
                        disabled={decision.isPending}
                        onClick={() => ask(
                            { title: 'Approve and carry it out?', body: approval.summary, confirm: 'Approve' },
                            () => decide(true),
                        )}
                    >
                        Approve
                    </Button>
                    <Button variant="secondary" icon={<X />} disabled={decision.isPending} onClick={() => decide(false)}>Deny</Button>
                </div>
            </div>
        </Panel>
    );
};

/**
 * One request: what it will do, who asked and for whom, its arguments as they were saved (text a
 * player or an assistant wrote shows as text), the node deciding it needs and when it expires;
 * approving or denying it while it is pending, and once decided who decided, their note and what
 * carrying it out answered.
 */
export const ApprovalPage = () => {
    const id = Number(useParams().id);
    const me = useMe().data;
    const query = useApproval(id);
    const approval = query.data;
    const linked = me?.canViewPlayers ?? false;

    return (
        <>
            <PageHeader
                title={approval ? approval.summary : `Approval #${id}`}
                description={approval ? `Approval #${approval.id}, asked ${fromNow(approval.requestedAtUtc)}` : undefined}
                back={{ to: '/approvals', label: 'Approvals' }}
            >
                {approval && <ApprovalBadge approval={approval} />}
            </PageHeader>
            <PageBody>
                {query.error && <ErrorNotice error={query.error} />}
                {query.isPending && <Loading />}
                {approval && (
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <div className="flex min-w-0 flex-col gap-4">
                            <Panel title="What it will do" description="The handler of its kind is given these arguments.">
                                <p className="px-4 pt-3 text-sm wrap-anywhere whitespace-pre-wrap">{approval.summary}</p>
                                <pre className="m-4 overflow-x-auto rounded-lg border border-line bg-canvas p-3 font-mono text-xs wrap-anywhere whitespace-pre-wrap">
                                    {JSON.stringify(approval.arguments, null, 2)}
                                </pre>
                            </Panel>

                            {approval.state === 'pending' && (approval.canDecide
                                ? <Decide approval={approval} />
                                : (
                                        <Panel title="Decide">
                                            <p className="px-4 py-3 text-sm text-muted">{whyNot(approval)}</p>
                                        </Panel>
                                    ))}

                            {approval.result !== null && (
                                <Panel title={approval.state === 'failed' ? 'Why it failed' : 'What it answered'}>
                                    <p className="px-4 py-3 text-sm wrap-anywhere whitespace-pre-wrap">{approval.result || <span className="text-muted">Nothing.</span>}</p>
                                </Panel>
                            )}
                        </div>

                        <div className="flex min-w-0 flex-col gap-4">
                            <Panel title="Details">
                                <dl>
                                    <Kv label="Kind" mono>{approval.kind}</Kv>
                                    <Kv label="From">{approval.plugin ?? 'the server'}</Kv>
                                    <Kv label="Asked by"><Requester approval={approval} linked={linked} /></Kv>
                                    <Kv label="Asked">{formatDateTime(approval.requestedAtUtc)}</Kv>
                                    <Kv label="Needs" mono>{approval.node}</Kv>
                                    {approval.state === 'pending' && <Kv label="Expires">{fromNow(approval.expiresAtUtc)}</Kv>}
                                    {approval.decidedAtUtc && (
                                        <Kv label={approval.state === 'expired' ? 'Expired' : approval.state === 'denied' ? 'Denied' : 'Approved'}>
                                            {formatDateTime(approval.decidedAtUtc)}
                                        </Kv>
                                    )}
                                    {approval.state !== 'pending' && approval.state !== 'expired' && <Kv label="By"><Decider approval={approval} linked={linked} /></Kv>}
                                    {approval.note && <Kv label="Note"><span className="wrap-anywhere">{approval.note}</span></Kv>}
                                    {approval.executedAtUtc && <Kv label="Carried out">{formatDateTime(approval.executedAtUtc)}</Kv>}
                                </dl>
                            </Panel>
                        </div>
                    </div>
                )}
            </PageBody>
        </>
    );
};
