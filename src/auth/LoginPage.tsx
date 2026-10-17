import { KeyRound } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { post } from '#/api/client';
import type { SessionResponse } from '#/api/types';
import { AuthCard } from '#/components/AuthCard';
import { Button, ErrorNotice } from '#/components/ui';

import { isLive, toSession, useSession } from './session';
import { type Ceremony, getPasskey, passkeysSupported } from './webauthn';

/**
 * Signing in, from any browser: a passkey is the only way. No name is typed; the device offers
 * the passkeys it holds for the panel, and the one picked says whose it is.
 */
export const LoginPage = () => {
    const navigate = useNavigate();
    const session = useSession(state => state.session);
    const signIn = useSession(state => state.signIn);
    const [ busy, setBusy ] = useState(false);
    const [ error, setError ] = useState<unknown>(null);

    if (isLive(session))
        return <Navigate to="/" replace />;

    const handleSignIn = async () => {
        setBusy(true);
        setError(null);

        try {
            const ceremony = await post<Ceremony<Record<string, unknown>>>('/auth/options');
            const credential = await getPasskey(ceremony.options);
            const response = await post<SessionResponse>('/auth/passkey', { ceremonyId: ceremony.ceremonyId, credential });

            signIn(toSession(response));
            navigate('/', { replace: true });
        } catch (reason) {
            setError(reason);
            setBusy(false);
        }
    };

    return (
        <AuthCard title="Sign in">
            <div className="space-y-4">
                {error !== null && <ErrorNotice error={error} />}
                {!passkeysSupported() && <ErrorNotice error={new Error('This browser cannot use passkeys, which signing in needs.')} />}
                <p className="text-sm text-muted">
                    Sign in with your passkey: Face ID, Touch ID, Windows Hello, your phone or a security key.
                </p>
                <Button className="w-full" icon={<KeyRound />} onClick={handleSignIn} disabled={busy || !passkeysSupported()}>
                    {busy ? 'Waiting for your passkey...' : 'Sign in with passkey'}
                </Button>
            </div>
            <p className="mt-6 text-xs text-muted">
                No passkey yet, or lost yours? An admin can give you a setup link.
            </p>
        </AuthCard>
    );
};
