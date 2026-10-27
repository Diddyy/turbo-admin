import { Link } from 'react-router';

import type { ApprovalItem, ApprovalState } from '#/api/approvals';
import { Badge, type BadgeTone } from '#/components/ui';

const STATE_TONES: Record<ApprovalState, BadgeTone> = {
    pending: 'amber',
    approved: 'accent',
    executed: 'green',
    failed: 'red',
    denied: 'neutral',
    expired: 'neutral',
};

export const STATE_LABELS: Record<ApprovalState, string> = {
    pending: 'pending',
    approved: 'approved, running',
    executed: 'approved, done',
    failed: 'approved, failed',
    denied: 'denied',
    expired: 'expired',
};

/** Where a request stands. */
export const ApprovalBadge = ({ approval }: { approval: ApprovalItem }) => (
    <Badge tone={STATE_TONES[approval.state]}>{STATE_LABELS[approval.state]}</Badge>
);

const KINDS: Record<ApprovalItem['requesterKind'], string> = {
    player: 'player',
    staff: 'staff',
    agent: 'AI agent',
    token: 'assistant',
    plugin: 'plugin',
    system: 'server',
};

/** A player on a request: a link to their page when you may look at players. */
const PlayerName = ({ id, name, linked }: { id: number; name: string | null; linked: boolean }) => {
    const label = name ?? `player #${id}`;

    return linked
        ? <Link to={`/players/${id}`} className="font-medium hover:text-accent">{label}</Link>
        : <span className="font-medium">{label}</span>;
};

/** Who asked: "an assistant (MCP) for Alice", "Bob (staff)", "an AI agent Helper". */
export const Requester = ({ approval, linked }: { approval: ApprovalItem; linked: boolean }) => {
    const kind = KINDS[approval.requesterKind];

    if (approval.requesterId === null)
        return <span>{approval.requesterName ?? kind} <span className="text-muted">({kind})</span></span>;

    const player = <PlayerName id={approval.requesterId} name={approval.requesterPlayerName} linked={linked} />;

    if (approval.requesterKind === 'player' || approval.requesterKind === 'staff')
        return <span>{player} <span className="text-muted">({kind})</span></span>;

    return <span><span className="text-muted">{approval.requesterName ? `${kind} ${approval.requesterName}` : kind} for </span>{player}</span>;
};

/** Who decided it, for a decided request. */
export const Decider = ({ approval, linked }: { approval: ApprovalItem; linked: boolean }) =>
    approval.decidedById === null
        ? <span className="text-muted">nobody</span>
        : <PlayerName id={approval.decidedById} name={approval.decidedByName} linked={linked} />;
