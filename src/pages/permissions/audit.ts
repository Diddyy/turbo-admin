import type { AuditEntry } from '#/api/permissions';
import type { ListOrder, SortKeys } from '#/lib/sort';

/** What each kind of permission change reads as in the log. */
export const ACTIONS: Record<string, string> = {
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

/** The order the server sends permission changes in. */
export const AUDIT_NEWEST: ListOrder = { sort: 'when', dir: 'desc' };

/** What each column of the permission log sorts by. */
export const AUDIT_KEYS: SortKeys<AuditEntry> = {
    when: x => Date.parse(x.atUtc),
    about: x => x.targetName,
    change: x => `${ACTIONS[x.action] ?? x.action} ${x.subject}`,
    by: x => x.actorName ?? 'console',
};
