import { useQueryClient } from '@tanstack/react-query';
import { KeyRound, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { post, remove } from '#/api/client';
import { useAccount } from '#/api/queries';
import type { AccountPasskey } from '#/api/types';
import { useSession } from '#/auth/session';
import { type Ceremony, createPasskey, getPasskey, passkeysSupported } from '#/auth/webauthn';
import { confirmAsync } from '#/components/confirm';
import { Button, EmptyState, ErrorNotice, Field, Loading, PageBody, PageHeader, Panel } from '#/components/ui';

type Options = Ceremony<Record<string, unknown>>;

const formatDate = (utc: string) => new Date(utc).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

const PasskeyRow = ({ passkey, isLast, onRemoved }: { passkey: AccountPasskey; isLast: boolean; onRemoved: () => void }) => {
    const [ error, setError ] = useState<unknown>(null);
    const [ busy, setBusy ] = useState(false);

    const handleRemove = async () => {
        if (!await confirmAsync({ title: `Remove the passkey "${passkey.name}"?`, body: 'It will no longer sign you in.', confirm: 'Remove' }))
            return;

        setBusy(true);
        setError(null);

        try {
            await remove(`/account/passkeys/${passkey.id}`);
            onRemoved();
        } catch (reason) {
            setError(reason);
            setBusy(false);
        }
    };

    return (
        <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
                <div className="font-medium">{passkey.name}</div>
                <div className="text-xs text-muted">
                    Added {formatDate(passkey.createdAtUtc)}
                    {passkey.lastUsedAtUtc ? `, last used ${formatDate(passkey.lastUsedAtUtc)}` : ', not used yet'}
                </div>
                {isLast && <div className="mt-1 text-xs text-muted">Your only passkey, so it cannot be removed. Add another first.</div>}
                {error !== null && <div className="mt-2"><ErrorNotice error={error} /></div>}
            </div>
            <Button variant="ghost" icon={<Trash2 />} onClick={handleRemove} disabled={busy || isLast}>
                Remove
            </Button>
        </li>
    );
};

/**
 * Adding a passkey: first one the player already has confirms it is them, then the new one is
 * made. Two prompts, so a session left open somewhere cannot add a way in.
 */
const AddPasskey = ({ onAdded }: { onAdded: () => void }) => {
    const [ name, setName ] = useState('');
    const [ step, setStep ] = useState<'idle' | 'confirm' | 'create'>('idle');
    const [ error, setError ] = useState<unknown>(null);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        try {
            setStep('confirm');
            const confirm = await post<Options>('/account/confirm');
            const answer = await getPasskey(confirm.options);
            const create = await post<Options>('/account/passkeys/options', { ceremonyId: confirm.ceremonyId, credential: answer });

            setStep('create');
            const credential = await createPasskey(create.options);

            await post('/account/passkeys', { ceremonyId: create.ceremonyId, credential, name });
            setName('');
            onAdded();
        } catch (reason) {
            setError(reason);
        } finally {
            setStep('idle');
        }
    };

    const label = {
        idle: 'Add passkey',
        confirm: 'Confirm with a passkey you have...',
        create: 'Create the new passkey...',
    }[step];

    return (
        <form onSubmit={handleSubmit} className="space-y-3 border-t border-line p-4">
            <h3 className="text-sm font-semibold">Add a passkey</h3>
            <p className="text-xs text-muted">
                You confirm with a passkey you already have, then make the new one: on this device, or a phone or security key.
            </p>
            {error !== null && <ErrorNotice error={error} />}
            <Field label="Name" name="passkey-name" value={name} onChange={event => setName(event.target.value)} maxLength={64} placeholder="Phone" />
            <Button type="submit" icon={<KeyRound />} disabled={step !== 'idle' || !passkeysSupported()}>{label}</Button>
        </form>
    );
};

/** The signed-in player's passkeys: their only way to sign in. */
export const AccountPage = () => {
    const account = useAccount();
    const queryClient = useQueryClient();
    const player = useSession(state => state.session?.player);
    const refresh = () => queryClient.invalidateQueries({ queryKey: [ 'account' ] });

    return (
        <>
            <PageHeader title="Account" description={player ? `Signed in as ${player.name}` : undefined} />
            <PageBody>
                {account.isPending && <Loading />}
                {account.error && <ErrorNotice error={account.error} />}
                {account.data && (
                    <div className="max-w-2xl">
                        <Panel title="Passkeys" description="How you sign in. Keep more than one, so losing a device does not lock you out.">
                            {account.data.passkeys.length === 0
                                ? <EmptyState>You have no passkeys yet. Add one below so you can sign in again.</EmptyState>
                                : (
                                        <ul className="divide-y divide-line">
                                            {account.data.passkeys.map(passkey => (
                                                <PasskeyRow
                                                    key={passkey.id}
                                                    passkey={passkey}
                                                    isLast={account.data.passkeys.length === 1}
                                                    onRemoved={refresh}
                                                />
                                            ))}
                                        </ul>
                                    )}
                            <AddPasskey onAdded={refresh} />
                        </Panel>
                    </div>
                )}
            </PageBody>
        </>
    );
};
