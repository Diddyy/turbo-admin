import { useMutation, useQueryClient } from '@tanstack/react-query';
import { RotateCw } from 'lucide-react';
import { useState } from 'react';

import { cancelRestart, restartServer, restartState, type ServerRestartStatus, useServerRestart } from '#/api/server';
import { ask } from '#/components/confirm';
import { Button, ErrorNotice, Input, Labeled, Segmented } from '#/components/ui';

const RESTART_MINUTES = [
    { value: '0', label: 'Now' },
    { value: '1', label: '1 min' },
    { value: '5', label: '5 min' },
    { value: '10', label: '10 min' },
];

/**
 * Restarting the server, for staff with `admin.server.restart`: a countdown players are warned of
 * as of a shutdown, then everyone is sent home, everything is saved and the server stops for its
 * host to start it again, so the settings waiting on a restart apply. While one counts down it can
 * be called off. When the hotel shows players a countdown notice for a restart, the restart may
 * name where it links to (the hotel's default otherwise). `compact` leaves out the explanation, for
 * the Settings page's notice.
 */
export const RestartServer = ({ compact = false }: { compact?: boolean }) => {
    const queryClient = useQueryClient();
    const { data: status, error: unreachable } = useServerRestart();
    const [ minutes, setMinutes ] = useState('1');
    const [ reason, setReason ] = useState('');
    const [ link, setLink ] = useState('');

    const act = useMutation({
        mutationFn: (run: () => Promise<ServerRestartStatus>) => run(),
        onSuccess: data => queryClient.setQueryData([ 'server-restart' ], data),
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: [ 'dashboard' ] });
            void queryClient.invalidateQueries({ queryKey: [ 'settings' ] });
        },
    });

    if (!status?.canRestart)
        return null;

    // The panel is served by the server it restarts: while it is down, nothing answers.
    if (status.restarting || (unreachable && act.isSuccess))
        return <p className="text-sm text-muted">The server is restarting. The panel answers again when its host has started it.</p>;

    const restart = () => {
        const wait = Number(minutes);

        ask({
            title: wait === 0 ? 'Restart the server now?' : `Restart the server in ${wait} min?`,
            body: `${wait === 0 ? 'Everyone is sent home now' : `Players are warned, then sent home in ${wait} min`}; everything is saved and the server stops with exit code ${status.exitCode} for its host to start it again. Without a host that restarts it, it stays stopped.`,
            confirm: 'Restart',
            danger: true,
        }, () => act.mutate(() => restartServer(wait, reason.trim() || undefined, (status.notice && link.trim()) || undefined)));
    };

    if (status.scheduled)
        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm">{restartState(status)}{status.reason && <span className="text-muted"> ({status.reason})</span>}.</p>
                {status.notice && <p className="text-xs text-muted">Players see a countdown notice{status.noticeLink ? <> linking to <span className="font-mono">{status.noticeLink}</span></> : null}; calling it off takes it down.</p>}
                <Button variant="secondary" disabled={act.isPending} onClick={() => act.mutate(cancelRestart)} className="sm:self-start">Call it off</Button>
                {act.error && <ErrorNotice error={act.error} />}
            </div>
        );

    return (
        <div className="flex flex-col gap-3">
            {!compact && <p className="text-xs text-muted">Players are reminded as it runs out, then sent home; everything is saved and the server stops for its host to start it again, so settings waiting on a restart apply.</p>}
            <Labeled label="Restart in">
                <Segmented label="Restart in" value={minutes} onChange={setMinutes} options={RESTART_MINUTES} />
            </Labeled>
            <Labeled label="Reason (optional)">
                <Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Shown to players" />
            </Labeled>
            {status.notice && (
                <Labeled label="Notice link (optional)" hint="Players also see a countdown notice; a click opens this. A web address or a client link (habbopages/...).">
                    <Input value={link} onChange={event => setLink(event.target.value)} placeholder={status.noticeLink || 'Nowhere'} />
                </Labeled>
            )}
            <Button variant="danger" icon={<RotateCw />} disabled={act.isPending} onClick={restart} className="sm:self-start">
                {minutes === '0' ? 'Restart now' : `Restart in ${minutes} min`}
            </Button>
            {act.error && <ErrorNotice error={act.error} />}
        </div>
    );
};
