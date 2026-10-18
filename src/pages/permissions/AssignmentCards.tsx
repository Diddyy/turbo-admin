import { Plus, Trash2 } from 'lucide-react';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { type MetaAssignment, type NodeAssignment, type Target, targetCalls, useCatalog, usePermissionChange } from '#/api/permissions';
import { ask } from '#/components/confirm';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { Button, EmptyState, ErrorNotice, Input, Labeled, Panel, Select } from '#/components/ui';

import { ADD_FORM_CLASS, Expiry, TimingFields, UnsetButton, Verdict } from './common';

/** The answer to the last change: an error, or the server's word that nothing changed. */
const Outcome = ({ error, message }: { error: unknown; message: string | null }) => (
    <>
        {error !== null && error !== undefined && <div className="px-4 pb-3"><ErrorNotice error={error} /></div>}
        {message && <p className="px-4 pb-3 text-xs text-muted">{message}</p>}
    </>
);

/** Every registered node, and a wildcard for each prefix of one, for the node box to suggest. */
const useNodeSuggestions = () => {
    const catalog = useCatalog();

    return useMemo(() => {
        const nodes = catalog.data?.nodes ?? [];
        const wildcards = new Set<string>([ '*' ]);

        for (const { node } of nodes) {
            const parts = node.split('.');

            for (let index = 1; index < parts.length; index++)
                wildcards.add(`${parts.slice(0, index).join('.')}.*`);
        }

        return [ ...nodes.map(x => ({ value: x.node, label: x.description })), ...[ ...wildcards ].sort().map(x => ({ value: x, label: 'wildcard' })) ];
    }, [ catalog.data ]);
};

/**
 * The nodes set on a group or player, and, for an editor, granting, denying and unsetting them.
 * A temporary and a permanent assignment of one node are separate rows; removing says which.
 */
export const NodesCard = ({ target, nodes, canEdit }: { target: Target; nodes: NodeAssignment[]; canEdit: boolean }) => {
    const calls = targetCalls(target);
    const set = usePermissionChange(calls.setNode);
    const unset = usePermissionChange(calls.unsetNode);
    const suggestions = useNodeSuggestions();
    const listId = useId();
    const [ node, setNode ] = useState('');
    const [ value, setValue ] = useState(true);
    const [ duration, setDuration ] = useState('');
    const [ extend, setExtend ] = useState(false);
    const [ message, setMessage ] = useState<string | null>(null);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setMessage(null);
        unset.reset();
        set.mutate([ node.trim(), value, { duration, extend } ], {
            onSuccess: (response) => {
                setMessage(response.changed ? null : response.message);

                if (response.changed)
                    setNode('');
            },
        });
    };

    const handleRemove = (assignment: NodeAssignment) => {
        ask({ title: `Remove the node ${assignment.node}?`, confirm: 'Remove' }, () => {
            setMessage(null);
            set.reset();
            unset.mutate([ assignment.node, assignment.expiresAtUtc !== null ]);
        });
    };

    return (
        <Panel
            title={`Nodes (${nodes.length})`}
            description="Set here directly. A denial beats a grant at the same place; an exact node beats a wildcard."
            className="overflow-hidden"
        >
            {nodes.length === 0
                ? <EmptyState>No nodes are set here.</EmptyState>
                : (
                        <RowList
                            columns={canEdit ? 'minmax(0,1fr) max-content max-content' : 'minmax(0,1fr) max-content'}
                            headers={[ { label: 'Node' }, { label: 'Value' }, ...(canEdit ? [ {} ] : []) ]}
                        >
                            {nodes.map(assignment => (
                                <Row key={`${assignment.node}|${assignment.expiresAtUtc ?? ''}`}>
                                    <div className="wrap-anywhere">
                                        {assignment.node.endsWith('*')
                                            ? <code className="font-mono text-xs">{assignment.node}</code>
                                            : (
                                                    <Link
                                                        to={`/permissions/search?node=${encodeURIComponent(assignment.node)}`}
                                                        className="font-mono text-xs hover:text-accent"
                                                        title="Who else is given it"
                                                    >
                                                        {assignment.node}
                                                    </Link>
                                                )}
                                        {assignment.description && <div className="text-xs text-muted">{assignment.description}</div>}
                                    </div>
                                    <span className="inline-flex flex-wrap items-center gap-1.5">
                                        <Verdict value={assignment.value} />
                                        <Expiry at={assignment.expiresAtUtc} />
                                    </span>
                                    {canEdit && (
                                        <UnsetButton
                                            label={`Unset ${assignment.node}`}
                                            icon={<Trash2 />}
                                            disabled={unset.isPending}
                                            onClick={() => handleRemove(assignment)}
                                            className="ml-auto"
                                        />
                                    )}
                                </Row>
                            ))}
                        </RowList>
                    )}
            {canEdit && (
                <form onSubmit={handleSubmit} className={ADD_FORM_CLASS}>
                    <Labeled label="Node" className="sm:min-w-48 sm:flex-1">
                        <Input
                            value={node}
                            onChange={event => setNode(event.target.value)}
                            list={listId}
                            placeholder="room.enter.locked, room.*"
                            spellCheck={false}
                            autoComplete="off"
                            className="w-full font-mono"
                        />
                    </Labeled>
                    <datalist id={listId}>
                        {suggestions.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </datalist>
                    <Labeled label="Grant or deny">
                        <Select value={value ? 'grant' : 'deny'} onChange={event => setValue(event.target.value === 'grant')}>
                            <option value="grant">Grant</option>
                            <option value="deny">Deny</option>
                        </Select>
                    </Labeled>
                    <TimingFields duration={duration} extend={extend} onDuration={setDuration} onExtend={setExtend} />
                    <Button type="submit" icon={<Plus />} disabled={set.isPending || node.trim() === ''}>Set</Button>
                </form>
            )}
            <Outcome error={set.error ?? unset.error} message={message} />
        </Panel>
    );
};

/** The meta values set on a group or player: limits, the client level, a plugin's settings. */
export const MetaCard = ({ target, meta, canEdit }: { target: Target; meta: MetaAssignment[]; canEdit: boolean }) => {
    const calls = targetCalls(target);
    const set = usePermissionChange(calls.setMeta);
    const unset = usePermissionChange(calls.unsetMeta);
    const catalog = useCatalog();
    const listId = useId();
    const [ key, setKey ] = useState('');
    const [ value, setValue ] = useState('');
    const [ duration, setDuration ] = useState('');
    const [ extend, setExtend ] = useState(false);
    const [ message, setMessage ] = useState<string | null>(null);

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        setMessage(null);
        unset.reset();
        set.mutate([ key.trim(), value.trim(), { duration, extend } ], {
            onSuccess: (response) => {
                setMessage(response.changed ? null : response.message);

                if (response.changed) {
                    setKey('');
                    setValue('');
                }
            },
        });
    };

    return (
        <Panel title={`Meta (${meta.length})`} description="Values rather than yes or no: limits, the client level." className="overflow-hidden">
            {meta.length === 0
                ? <EmptyState>No meta is set here.</EmptyState>
                : (
                        <RowList
                            columns={canEdit ? 'minmax(0,1fr) minmax(0,1fr) max-content' : 'minmax(0,1fr) minmax(0,1fr)'}
                            headers={[ { label: 'Key' }, { label: 'Value' }, ...(canEdit ? [ {} ] : []) ]}
                        >
                            {meta.map(assignment => (
                                <Row key={`${assignment.key}|${assignment.expiresAtUtc ?? ''}`}>
                                    <div className="wrap-anywhere">
                                        <code className="font-mono text-xs">{assignment.key}</code>
                                        {assignment.description && <div className="text-xs text-muted">{assignment.description}</div>}
                                    </div>
                                    <span className="inline-flex flex-wrap items-center gap-1.5 wrap-anywhere">
                                        <PhoneLabel>=</PhoneLabel>
                                        <code className="font-mono text-xs">{assignment.value}</code>
                                        <Expiry at={assignment.expiresAtUtc} />
                                    </span>
                                    {canEdit && (
                                        <UnsetButton
                                            label={`Unset ${assignment.key}`}
                                            icon={<Trash2 />}
                                            disabled={unset.isPending}
                                            onClick={() => ask({ title: `Remove the meta ${assignment.key}?`, confirm: 'Remove' }, () => {
                                                setMessage(null);
                                                set.reset();
                                                unset.mutate([ assignment.key, assignment.expiresAtUtc !== null ]);
                                            })}
                                            className="ml-auto"
                                        />
                                    )}
                                </Row>
                            ))}
                        </RowList>
                    )}
            {canEdit && (
                <form onSubmit={handleSubmit} className={ADD_FORM_CLASS}>
                    <Labeled label="Key" className="sm:min-w-36 sm:flex-1">
                        <Input
                            value={key}
                            onChange={event => setKey(event.target.value)}
                            list={listId}
                            placeholder="limit.rooms"
                            spellCheck={false}
                            autoComplete="off"
                            className="w-full font-mono"
                        />
                    </Labeled>
                    <datalist id={listId}>
                        {catalog.data?.metaKeys.map(x => <option key={x.key} value={x.key}>{x.description}</option>)}
                    </datalist>
                    <Labeled label="Value" className="sm:w-28">
                        <Input value={value} onChange={event => setValue(event.target.value)} placeholder="5" />
                    </Labeled>
                    <TimingFields duration={duration} extend={extend} onDuration={setDuration} onExtend={setExtend} />
                    <Button type="submit" icon={<Plus />} disabled={set.isPending || key.trim() === '' || value.trim() === ''}>Set</Button>
                </form>
            )}
            <Outcome error={set.error ?? unset.error} message={message} />
        </Panel>
    );
};
