import { History, KeyRound, ListTree, Search, ShieldCheck, Users } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

import type { AuditEntry } from '#/api/permissions';
import { useMe } from '#/api/queries';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import type { TabItem } from '#/components/Tabs';
import { Badge, EmptyState, Labeled, PageHeader, Select } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';
import { formatDateTime } from '#/pages/rooms/labels';

import { DURATIONS, targetLink } from './links';

export type Section = 'groups' | 'players' | 'search' | 'log' | 'nodes' | 'passkeys';

const SECTIONS: TabItem[] = [
    { value: 'groups', label: 'Groups', icon: <ListTree />, to: '/permissions/groups' },
    { value: 'players', label: 'Players', icon: <Users />, to: '/permissions/players' },
    { value: 'search', label: 'Who has a node', icon: <Search />, to: '/permissions/search' },
    { value: 'log', label: 'Log', icon: <History />, to: '/permissions/log' },
    { value: 'nodes', label: 'Nodes', icon: <KeyRound />, to: '/permissions/nodes' },
];

const PASSKEYS: TabItem = { value: 'passkeys', label: 'Staff passkeys', icon: <ShieldCheck />, to: '/staff' };

/**
 * The header every access page shares: its own title, and the sections' tabs under it, the
 * permissions' and the staff passkeys', each only for who may open it.
 */
export const PermissionsHeader = ({ section, title = 'Access', description, back, children }: {
    section: Section;
    title?: string;
    description?: ReactNode;
    back?: { to: string; label: string };
    children?: ReactNode;
}) => {
    const { data: me } = useMe();
    const items = [ ...(me?.canViewPermissions ? SECTIONS : []), ...(me?.canResetPasskeys ? [ PASSKEYS ] : []) ];

    return (
        <PageHeader
            title={title}
            description={description}
            back={back}
            tabs={items.length > 1 ? { items, value: section } : undefined}
        >
            {children}
        </PageHeader>
    );
};

/** When an assignment ends, or that it does not. */
export const Expiry = ({ at }: { at: string | null }) =>
    at ? <Badge tone="amber">until {formatDateTime(at)}</Badge> : null;

/** A node's value: granted or denied. */
export const Verdict = ({ value }: { value: boolean }) =>
    <Badge tone={value ? 'green' : 'red'}>{value ? 'grant' : 'deny'}</Badge>;

/**
 * How long a new assignment lasts, and whether a running one is extended rather than replaced,
 * each with its label; the Extend box says what it does under it.
 */
export const TimingFields = ({ duration, extend, onDuration, onExtend }: {
    duration: string;
    extend: boolean;
    onDuration: (value: string) => void;
    onExtend: (value: boolean) => void;
}) => (
    <>
        <Labeled label="How long" className="sm:w-36">
            <Select value={duration} onChange={event => onDuration(event.target.value)} className="w-full">
                {DURATIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
        </Labeled>
        {duration !== '' && (
            <label className="flex items-start gap-2 text-sm select-none sm:max-w-60">
                <input type="checkbox" checked={extend} onChange={event => onExtend(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-accent" />
                <span>
                    Extend
                    <span className="block text-xs text-muted">Add the time to one already running, instead of replacing its end.</span>
                </span>
            </label>
        )}
    </>
);

/** The layout every add form in an access card shares: stacked fields with labels on a phone, a row from a tablet up. */
export const ADD_FORM_CLASS = 'flex flex-col gap-3 border-t border-line p-4 sm:flex-row sm:flex-wrap sm:items-end';

/** A row's remove button: only an icon, a thumb's size on a phone and small from a tablet up. */
export const UnsetButton = ({ label, icon, className, ...button }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        {...button}
        className={cx(
            'grid size-11 shrink-0 place-items-center rounded-lg border border-transparent text-muted transition hover:border-line hover:bg-subtle hover:text-ink disabled:pointer-events-none disabled:opacity-50 sm:size-7 [&>svg]:size-4',
            className,
        )}
    >
        {icon}
    </button>
);

const ACTIONS: Record<string, string> = {
    NodeSet: 'set node',
    NodeUnset: 'unset node',
    MetaSet: 'set meta',
    MetaUnset: 'unset meta',
    GroupAdded: 'added to group',
    GroupRemoved: 'removed from group',
    ParentAdded: 'added parent',
    ParentRemoved: 'removed parent',
    GroupCreated: 'created group',
    GroupDeleted: 'deleted group',
    GroupReweighted: 'reweighted',
    GroupRenamed: 'renamed',
    Expired: 'expired',
};

/** Permission changes, newest first: when, by whom, about whom, and what. */
export const AuditTable = ({ entries, showTarget = true }: { entries: AuditEntry[]; showTarget?: boolean }) =>
    entries.length === 0
        ? <EmptyState>No changes recorded.</EmptyState>
        : (
                <RowList
                    columns={showTarget ? 'max-content minmax(0,1fr) minmax(0,2fr) max-content' : 'max-content minmax(0,2fr) max-content'}
                    headers={[ { label: 'When' }, ...(showTarget ? [ { label: 'About' } ] : []), { label: 'Change' }, { label: 'By' } ]}
                >
                    {entries.map((entry, index) => (
                        <Row key={index}>
                            <span className="text-xs whitespace-nowrap text-muted sm:text-sm" title={formatDateTime(entry.atUtc)}>{fromNow(entry.atUtc)}</span>
                            {showTarget && (
                                <span>
                                    <span className="mr-1.5 text-xs text-muted">{entry.targetType === 'Group' ? 'group' : 'player'}</span>
                                    <Link to={targetLink(entry.targetType, entry.targetId, entry.targetName)} className="font-medium hover:text-accent">
                                        {entry.targetName}
                                    </Link>
                                </span>
                            )}
                            <span className="basis-full wrap-anywhere sm:basis-auto">
                                <span className="text-muted">{ACTIONS[entry.action] ?? entry.action}</span>
                                {' '}
                                <code className="font-mono text-xs">{entry.subject}</code>
                                {entry.value !== null && (
                                    <>
                                        {' = '}
                                        <code className="font-mono text-xs">{entry.value}</code>
                                    </>
                                )}
                                {entry.expiresAtUtc && <span className="ml-2"><Expiry at={entry.expiresAtUtc} /></span>}
                            </span>
                            <span className="whitespace-nowrap">
                                <PhoneLabel>by </PhoneLabel>
                                {entry.actorId !== null
                                    ? <Link to={`/permissions/players/${entry.actorId}`} className="hover:text-accent">{entry.actorName}</Link>
                                    : <span className="text-muted">console</span>}
                            </span>
                        </Row>
                    ))}
                </RowList>
            );
