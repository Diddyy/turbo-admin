import { Copy, KeyRound } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { post } from '#/api/client';
import type { PasskeyLinkResponse } from '#/api/types';
import { Button, ErrorNotice, Field, Input, PageBody, Panel, SuccessNotice, WarningNotice } from '#/components/ui';
import { PermissionsHeader } from '#/pages/permissions/common';

const LinkResult = ({ result }: { result: PasskeyLinkResponse }) => {
    const [ copied, setCopied ] = useState(false);

    const copy = async () => {
        await navigator.clipboard.writeText(result.link);
        setCopied(true);
    };

    return (
        <div className="space-y-3">
            <SuccessNotice>
                {result.replacesExisting ? 'Passkey reset link' : 'Passkey setup link'} for {result.playerName}. It works once, until{' '}
                {new Date(result.expiresAtUtc).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}.
            </SuccessNotice>
            {result.replacesExisting && (
                <WarningNotice>
                    Using it removes all of {result.playerName}&apos;s current passkeys.
                </WarningNotice>
            )}
            {!result.hasPanelAccess && (
                <WarningNotice>
                    {result.playerName} does not have the admin.panel permission, so the passkey will not sign them in until they do.
                </WarningNotice>
            )}
            <div className="flex gap-2">
                <Input
                    readOnly
                    value={result.link}
                    aria-label="Setup link"
                    onFocus={event => event.target.select()}
                    className="min-w-0 flex-1 bg-subtle font-mono text-xs"
                />
                <Button variant="secondary" icon={<Copy />} onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
            </div>
            <p className="text-xs text-muted">
                Send it to them privately. Whoever opens it first makes the passkey that signs in as them.
            </p>
        </div>
    );
};

/**
 * Giving other staff their way in: a link that sets up their passkey, or replaces the ones they
 * lost. Only for players whose every permission you hold too.
 */
export const StaffPage = () => {
    const [ name, setName ] = useState('');
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState<unknown>(null);
    const [ result, setResult ] = useState<PasskeyLinkResponse | null>(null);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        setResult(null);

        try {
            setResult(await post<PasskeyLinkResponse>('/staff/passkey-links', { name }));
        } catch (reason) {
            setError(reason);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <PermissionsHeader section="passkeys" description="Setup and reset links for other staff's passkeys" />
            {/* The page's full width, as under the other access tabs, with the form kept to a readable column. */}
            <PageBody>
                <div className="grid max-w-2xl gap-5">
                    <Panel
                        title="Set up or reset a passkey"
                        description="A one-time link for a staff member to create their passkey. For someone who already has one, it replaces them all, for a lost device. Only for players whose permissions you all hold yourself."
                    >
                        <form onSubmit={handleSubmit} className="space-y-3 p-4">
                            {error !== null && <ErrorNotice error={error} />}
                            <Field label="Player name" name="player" value={name} onChange={event => setName(event.target.value)} placeholder="Their name in the hotel" required />
                            <Button type="submit" icon={<KeyRound />} disabled={busy || name.trim() === ''}>Make link</Button>
                        </form>
                    </Panel>
                    {result && <Panel className="p-4"><LinkResult result={result} /></Panel>}
                </div>
            </PageBody>
        </>
    );
};
