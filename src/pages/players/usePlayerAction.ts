import { useMutation, useQueryClient } from '@tanstack/react-query';

import { post } from '#/api/client';
import { actOnPlayer, type PlayerActionRequest, type PlayerDetailResponse } from '#/api/players';
import type { RunCommandResponse } from '#/api/types';
import { ask, type Question } from '#/components/confirm';

/**
 * Runs actions on a player: each the hotel's own command, as you, after a confirmation when it
 * asks for one; the player's page is asked again after each, so balances, sanctions and their
 * inventory show what it did.
 */
export const usePlayerAction = (player: PlayerDetailResponse) => {
    const queryClient = useQueryClient();

    const act = useMutation({
        mutationFn: (run: () => Promise<RunCommandResponse>) => run(),
        onSettled: () => void queryClient.invalidateQueries({ queryKey: [ 'player', player.id ] }),
    });

    const run = (request: PlayerActionRequest, question?: Question, then?: () => void) => {
        const go = () => {
            act.mutate(() => actOnPlayer(player.id, request));
            then?.();
        };

        if (question)
            ask(question, go);
        else
            go();
    };

    /** Runs `:confirm` as you, for a command that waits for one. */
    const confirmPending = () => act.mutate(() => post<RunCommandResponse>('/commands/run', { line: 'confirm' }));

    return { run, busy: act.isPending, act, confirmPending };
};

export type PlayerAction = ReturnType<typeof usePlayerAction>;
