import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';

import { type PlayerDetailResponse, usePlayerAbilities } from '#/api/players';
import { Button, EmptyState, Input, Panel } from '#/components/ui';

import { ActionAnswer } from './ActionAnswer';
import { type PlayerAction, usePlayerAction } from './usePlayerAction';

/** One currency: its balance, and giving or taking an amount of it. */
const CurrencyRow = ({ player, currency, action, canGive }: { player: PlayerDetailResponse; currency: PlayerDetailResponse['currencies'][number]; action: PlayerAction; canGive: boolean }) => {
    const [ amount, setAmount ] = useState('');
    const value = Math.trunc(Number(amount));
    const valid = amount !== '' && value > 0;

    const change = (sign: 1 | -1) => action.run(
        { action: 'give', currency: currency.name, amount: sign * value },
        sign < 0 ? { title: `Take ${value.toLocaleString()} ${currency.name} from ${player.name}?`, confirm: 'Take' } : undefined,
        () => setAmount(''),
    );

    return (
        <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 first:border-t-0">
            <div className="min-w-0 flex-[1_1_8rem]">
                <div className="text-xs font-medium text-muted">{currency.name}</div>
                <div className="font-mono text-xl font-semibold tabular-nums">{currency.amount.toLocaleString()}</div>
            </div>
            {canGive && (
                <form
                    className="flex min-w-0 flex-[1_1_16rem] items-center gap-2"
                    onSubmit={(event) => {
                        event.preventDefault();

                        if (valid)
                            change(1);
                    }}
                >
                    <Input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={amount}
                        onChange={event => setAmount(event.target.value)}
                        placeholder="Amount"
                        aria-label={`Amount of ${currency.name}`}
                        className="w-0 min-w-0 flex-1 font-mono"
                    />
                    <Button type="submit" variant="secondary" icon={<Plus />} disabled={action.busy || !valid}>Give</Button>
                    <Button variant="ghost" icon={<Minus />} disabled={action.busy || !valid} onClick={() => change(-1)}>Take</Button>
                </form>
            )}
        </li>
    );
};

/**
 * A player's balances, each with giving and taking an amount when you may (`:give`, run as you;
 * a negative amount takes).
 */
export const CurrenciesPanel = ({ player }: { player: PlayerDetailResponse }) => {
    const canGive = usePlayerAbilities().data?.give ?? false;
    const action = usePlayerAction(player);

    return (
        <Panel title="Currencies" description={canGive ? 'Give adds to the balance; take removes from it.' : undefined}>
            {(action.act.error || action.act.data) && (
                <div className="flex flex-col gap-2 border-b border-line p-4"><ActionAnswer action={action} /></div>
            )}
            {player.currencies.length === 0
                ? <EmptyState>No balances yet.</EmptyState>
                : (
                        <ul>
                            {player.currencies.map(currency => (
                                <CurrencyRow key={currency.typeId} player={player} currency={currency} action={action} canGive={canGive} />
                            ))}
                        </ul>
                    )}
        </Panel>
    );
};
