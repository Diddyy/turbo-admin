import { fetchThemeLive, type ThemeLive } from '#/api/appearance';
import { plural } from '#/lib/plural';

import { toast } from './toast';

/**
 * What a saved appearance change does, in one sentence every appearance editor uses: who has it
 * now. The server sends a change to every online player whose look it is part of and their client
 * draws it with no reload (live reload); a player whose theme it is not part of gets nothing, and
 * one who logs in now has it.
 */
export const savedLine = (what: string, live: ThemeLive | null) => {
    if (live === null) return `${what}: saved. Players get it at their next load.`;

    if (live.online === 0) return `${what}: saved. No one is online: every player has it from their next load.`;

    const others = live.online - live.players;
    const rest = (others > 0) ? ` The other ${plural(others, 'player')} online ${others === 1 ? 'draws a theme' : 'draw themes'} it is not part of.` : '';

    return `${what}: saved - live for ${plural(live.players, 'player')} now.${rest}`;
};

/** Says an appearance change was saved (`savedLine`), with the players it reached live. */
export const useSaved = () => (what: string) => void fetchThemeLive()
    .then(live => live, () => null)
    .then(live => toast(savedLine(what, live)));
