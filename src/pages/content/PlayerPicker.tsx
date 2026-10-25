import { useState } from 'react';

import { usePlayerSearch } from '#/api/players';
import { Input } from '#/components/ui';

/**
 * A player, found by name, or typed by id for staff who may not search players. Chosen by
 * clicking one found.
 */
export const PlayerPicker = ({ onPick, disabled }: { onPick: (player: { id: number; name: string }) => void; disabled?: boolean }) => {
    const [ text, setText ] = useState('');
    const byId = /^\d+$/.test(text.trim());
    const { data, error } = usePlayerSearch(text.trim(), byId ? 'id' : 'name', false, 0, null);
    const found = text.trim() ? data?.players.slice(0, 8) ?? [] : [];

    return (
        <div className="relative flex min-w-0 flex-1 flex-col gap-1">
            <Input value={text} onChange={event => setText(event.target.value)} placeholder="Player name or id" disabled={disabled} aria-label="Player" />
            {found.length > 0 && (
                <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
                    {found.map(player => (
                        <li key={player.id}>
                            <button
                                type="button"
                                className="flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-subtle"
                                onClick={() => {
                                    onPick({ id: player.id, name: player.name });
                                    setText('');
                                }}
                            >
                                <span>{player.name}</span>
                                <span className="font-mono text-xs text-muted">{player.id}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {error && byId && (
                <button type="button" className="self-start text-xs text-accent hover:underline" onClick={() => onPick({ id: Number(text.trim()), name: `#${text.trim()}` })}>
                    Use player {text.trim()}
                </button>
            )}
        </div>
    );
};
