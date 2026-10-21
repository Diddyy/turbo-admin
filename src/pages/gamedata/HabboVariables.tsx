import { useState } from 'react';

import { FILES, type GamedataStatus, HABBO_VARIABLE_ACTIONS, type HabboVariableUpdateItem, useHabboVariableUpdate, useTakeHabboVariables } from '#/api/gamedata';
import { SearchInput } from '#/components/SearchInput';
import { toast } from '#/components/toast';
import { Badge, Checkbox } from '#/components/ui';

import { showValue } from './labels';
import { HabboUpdate } from './parts';

/** A key's group: what comes before its first dot (`seasonalcurrency` of `seasonalcurrency.id.104`). */
const groupOf = (key: string) => key.split('.')[0] || key;

/** Whether the words are in the key or either value. */
const matches = (item: HabboVariableUpdateItem, words: string) =>
    [ item.key, item.habbo, item.current ].some(x => x?.toLowerCase().includes(words));

/** One key waiting: picked or not, what it does, and the hotel's value beside Habbo's. */
const VariableItem = ({ item, picked, canManage, onPick }: { item: HabboVariableUpdateItem; picked: boolean; canManage: boolean; onPick: (picked: boolean) => void }) => {
    const action = HABBO_VARIABLE_ACTIONS[item.action] ?? { name: String(item.action), tone: 'neutral' as const };

    return (
        <li className="grid items-start gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[1rem_5.5rem_minmax(10rem,1fr)_2fr]">
            <input
                type="checkbox"
                className="mt-0.5 size-4 rounded border-line accent-accent"
                aria-label={`Take in ${item.key}`}
                checked={picked}
                disabled={!canManage}
                onChange={event => onPick(event.target.checked)}
            />
            <span><Badge tone={action.tone}>{action.name}</Badge></span>
            <span className="min-w-0 font-mono text-xs break-all">{item.key}</span>
            <div className="flex min-w-0 flex-col gap-0.5 text-xs break-words">
                {item.current !== null && <span className="text-muted">Hotel: {showValue(item.current)}</span>}
                <span className={item.action === 2 ? 'text-bad' : undefined}>{item.habbo === null ? 'Habbo no longer has it' : `Habbo: ${item.habbo || '""'}`}</span>
            </div>
        </li>
    );
};

/**
 * Habbo's newest external variables: the keys it added, changed or dropped beside the hotel's,
 * by group, to pick and take in. Keys the hotel owns (a setting's, a file's, the reception's, the
 * ignore list's, addresses) are never listed.
 */
export const HabboVariables = ({ status, defaultOpen }: { status: GamedataStatus; defaultOpen?: boolean }) => {
    const version = status.latestVariables ?? null;
    const { data: preview, error } = useHabboVariableUpdate(version !== null);
    const take = useTakeHabboVariables();
    const [ text, setText ] = useState('');
    // What staff ticked or unticked. Untouched, a key Habbo changed is picked and one it added or removed is not: a quick
    // take-in follows Habbo's new values (a season's currency, a campaign page) but never switches on a feature flag the
    // hotel never had, whose server side it may lack, nor drops one of the hotel's keys.
    const [ choices, setChoices ] = useState<ReadonlyMap<string, boolean>>(() => new Map());
    const waiting = preview?.items ?? [];
    const isPicked = (item: HabboVariableUpdateItem) => choices.get(item.key) ?? item.action === 1;
    const picked = waiting.filter(isPicked);
    const words = text.trim().toLowerCase();
    const shown = words ? waiting.filter(x => matches(x, words)) : waiting;
    const groups = Map.groupBy(shown, x => groupOf(x.key));

    const pick = (keys: string[], on: boolean) => setChoices((was) => {
        const next = new Map(was);

        keys.forEach(key => next.set(key, on));

        return next;
    });

    const count = (action: number) => picked.filter(x => x.action === action).length;

    return (
        <HabboUpdate
            defaultOpen={defaultOpen}
            title="variables"
            version={version && { name: version.hash.slice(0, 10), holds: `${version.variableCount.toLocaleString()} variables`, foundAt: version.foundAt, importedAt: version.importedAt }}
            preview={preview && { added: preview.added, updated: preview.updated, kept: 0, unchanged: preview.unchanged, truncated: false, listed: waiting.length }}
            extra={preview && (
                <>
                    {preview.removed > 0 && <span><span className="text-bad">{preview.removed.toLocaleString()}</span> removed</span>}
                    <span title="Keys that follow a setting or a file, the reception's, the ignore list's and addresses: never taken from Habbo">{preview.protected.toLocaleString()} the hotel's own</span>
                </>
            )}
            error={error}
            file={FILES.externalVariables}
            canManage={status.canManage}
            canTake={waiting.length > 0}
            takeDisabled={picked.length === 0}
            confirm={{
                title: `Take in ${picked.length.toLocaleString()} of Habbo's variables?`,
                body: `${count(0)} are added, ${count(1)} updated and ${count(2)} removed. Clients get them when they next load, and it can be rolled back from the history.`,
            }}
            onTake={() => preview && take.mutate(
                { versionId: preview.version.id, keys: picked.map(x => x.key) },
                {
                    onSuccess: (data) => {
                        setChoices(new Map());
                        toast(data.changeSet ? `Took in ${picked.length.toLocaleString()} of Habbo's variables.` : 'Nothing was taken in: the hotel has them already.');
                    },
                },
            )}
            taking={take.isPending}
            takeError={take.error}
        >
            <li className="sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface px-4 py-2">
                <SearchInput value={text} onValueChange={setText} placeholder="Key or value" className="min-w-48 flex-1 sm:max-w-80" aria-label="Find Habbo's variables" />
                <span className="text-xs text-muted tabular-nums">{picked.length.toLocaleString()} of {waiting.length.toLocaleString()} picked</span>
                {status.canManage && (
                    <span className="flex gap-3 text-xs">
                        <button type="button" className="font-medium text-accent hover:underline" onClick={() => pick(shown.map(x => x.key), true)}>Pick {words ? 'shown' : 'all'}</button>
                        <button type="button" className="font-medium text-accent hover:underline" onClick={() => pick(shown.map(x => x.key), false)}>Pick none{words ? ' shown' : ''}</button>
                    </span>
                )}
            </li>
            {shown.length === 0 && <li className="px-4 py-3 text-sm text-muted">No key waiting has those words.</li>}
            {[ ...groups ].map(([ group, items ]) => (
                <li key={group}>
                    <div className="bg-subtle/40 px-4 py-1.5">
                        <Checkbox
                            label={<span className="font-mono text-xs">{group}.* <span className="text-muted">({items.length})</span></span>}
                            checked={items.every(isPicked)}
                            disabled={!status.canManage}
                            onChange={on => pick(items.map(x => x.key), on)}
                        />
                    </div>
                    <ul className="divide-y divide-line">
                        {items.map(item => <VariableItem key={item.key} item={item} picked={isPicked(item)} canManage={status.canManage} onPick={on => pick([ item.key ], on)} />)}
                    </ul>
                </li>
            ))}
        </HabboUpdate>
    );
};
