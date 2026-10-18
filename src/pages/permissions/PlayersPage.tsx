import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { findPlayer, useStaff } from '#/api/permissions';
import { Row, RowList } from '#/components/RowList';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Loading, PageBody, Panel } from '#/components/ui';

import { Expiry, PermissionsHeader } from './common';

/** Finding any player's permissions by name, and everyone in a group besides default. */
export const PlayersPage = () => {
    const navigate = useNavigate();
    const staff = useStaff();
    const [ name, setName ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState<unknown>(null);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(null);

        try {
            const player = await findPlayer(name.trim());

            navigate(`/permissions/players/${player.id}`);
        } catch (reason) {
            setError(reason);
            setBusy(false);
        }
    };

    return (
        <>
            <PermissionsHeader section="players" description="Any player's groups, nodes and meta, and why they hold what they hold" />
            <PageBody className="grid gap-4 lg:gap-5">
                <Panel title="Find a player">
                    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 p-4">
                        <SearchInput value={name} onValueChange={setName} placeholder="Their exact name" aria-label="Player name" className="min-w-48 flex-1 sm:max-w-80" />
                        <Button type="submit" disabled={busy || name.trim() === ''}>Open</Button>
                    </form>
                    {error !== null && <div className="px-4 pb-4"><ErrorNotice error={error} /></div>}
                </Panel>

                <Panel title="In a group" description="Everyone in a group besides default, heaviest group first." className="overflow-hidden">
                    {staff.isPending && <Loading />}
                    {staff.error && <div className="p-4"><ErrorNotice error={staff.error} /></div>}
                    {staff.data && (staff.data.length === 0
                        ? <EmptyState>Nobody is in a group besides default.</EmptyState>
                        : (
                                <RowList columns="minmax(0,14rem) minmax(0,1fr)" headers={[ { label: 'Player' }, { label: 'Groups' } ]}>
                                    {staff.data.map(member => (
                                        <Row key={member.id}>
                                            <Link to={`/permissions/players/${member.id}`} className="font-medium hover:text-accent">{member.name}</Link>
                                            <span className="flex flex-wrap gap-1.5">
                                                {member.groups.map(group => (
                                                    <span key={`${group.name}|${group.expiresAtUtc ?? ''}`} className="inline-flex items-center gap-1">
                                                        <Badge tone="accent">{group.displayName}</Badge>
                                                        <Expiry at={group.expiresAtUtc} />
                                                    </span>
                                                ))}
                                            </span>
                                        </Row>
                                    ))}
                                </RowList>
                            ))}
                </Panel>
            </PageBody>
        </>
    );
};
