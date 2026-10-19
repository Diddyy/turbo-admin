import { Link } from 'react-router';

import type { ReportItem } from '#/api/reports';
import { Badge } from '#/components/ui';
import { cx } from '#/lib/cx';

import { CLOSE_REASONS } from './labels';

/** A player on a report: a link to their page when you may look at players. */
export const PlayerLink = ({ id, name, linked, className }: { id: number; name: string | null; linked: boolean; className?: string }) => {
    const label = name ?? `player #${id}`;

    return linked
        ? <Link to={`/players/${id}`} className={cx('font-medium hover:text-accent', className)}>{label}</Link>
        : <span className={cx('font-medium', !name && 'text-muted', className)}>{label}</span>;
};

/** Where a report stands: open, held (by you or whom), or how it was closed. */
export const StateBadge = ({ report, me }: { report: ReportItem; me: number | undefined }) => {
    if (report.state === 'closed')
        return <Badge tone={report.closeReason === 'resolved' ? 'green' : 'neutral'}>{report.closeReason ? CLOSE_REASONS[report.closeReason].toLowerCase() : 'closed'}{report.sanctioned ? ', sanctioned' : ''}</Badge>;

    if (report.state === 'picked')
        return <Badge tone="accent">{report.pickerId === me ? 'yours' : `held by ${report.pickerName ?? `#${report.pickerId}`}`}</Badge>;

    return <Badge tone="amber">open</Badge>;
};
