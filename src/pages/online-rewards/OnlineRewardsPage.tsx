import { Plus, RotateCcw, Save, Trash2, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useCurrencies } from '#/api/content';
import { type ServerSetting, SOURCE, useResetSetting, useSaveSetting, useSettings } from '#/api/settings';
import { ask } from '#/components/confirm';
import { toast } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, PageBody, PageHeader, Panel, Select, Switch, Td, Th, WarningNotice } from '#/components/ui';

const SECTION = 'Turbo:OnlineRewards';

/** The settings this page sets, in the order the changes list them. */
const NAMES = [ 'Enabled', 'Rules', 'IdleMinutes', 'SkipSleeping' ] as const;

type Name = typeof NAMES[number];

const LABELS: Record<Name, string> = {
    Enabled: 'On',
    Rules: 'Rules',
    IdleMinutes: 'Idle after',
    SkipSleeping: 'Skip sleeping',
};

/** One rule as the server keeps it (`OnlineRewardRule`): its property names as they are, since the server reads them so. */
interface Rule {
    Currency: string;
    Amount: number;
    IntervalMinutes: number;
    HcBonus: number;
    DailyCap: number;
    Enabled: boolean;
}

interface Draft {
    enabled: boolean;
    rules: Rule[];
    idleMinutes: number;
    skipSleeping: boolean;
}

const pathOf = (name: Name) => `${SECTION}:${name}`;

const parse = (json: string | null): unknown => {
    try {
        return JSON.parse(json ?? 'null');
    } catch {
        return null;
    }
};

const ruleOf = (value: unknown): Rule | null => {
    if (typeof value !== 'object' || value === null) return null;

    const rule = value as Partial<Rule>;

    return {
        Currency: typeof rule.Currency === 'string' ? rule.Currency : '',
        Amount: typeof rule.Amount === 'number' ? rule.Amount : 0,
        IntervalMinutes: typeof rule.IntervalMinutes === 'number' ? rule.IntervalMinutes : 15,
        HcBonus: typeof rule.HcBonus === 'number' ? rule.HcBonus : 0,
        DailyCap: typeof rule.DailyCap === 'number' ? rule.DailyCap : 0,
        Enabled: typeof rule.Enabled === 'boolean' ? rule.Enabled : true,
    };
};

const draftOf = (settings: Record<Name, ServerSetting>): Draft => {
    const rules = parse(settings.Rules.value);
    const idle = parse(settings.IdleMinutes.value);

    return {
        enabled: parse(settings.Enabled.value) === true,
        rules: Array.isArray(rules) ? rules.map(ruleOf).filter((x): x is Rule => x !== null) : [],
        idleMinutes: typeof idle === 'number' ? idle : 10,
        skipSleeping: parse(settings.SkipSleeping.value) !== false,
    };
};

/** The JSON the server saves for one setting. */
const jsonOf = (name: Name, draft: Draft) => {
    switch (name) {
        case 'Enabled': return String(draft.enabled);
        case 'Rules': return JSON.stringify(draft.rules);
        case 'IdleMinutes': return String(draft.idleMinutes);
        case 'SkipSleeping': return String(draft.skipSleeping);
    }
};

/** A setting's value as staff read it in the list of changes. */
const shownOf = (name: Name, draft: Draft) => {
    switch (name) {
        case 'Enabled': return draft.enabled ? 'on' : 'off';
        case 'Rules': return draft.rules.length === 1 ? '1 rule' : `${draft.rules.length} rules`;
        case 'IdleMinutes': return draft.idleMinutes === 0 ? 'never' : `${draft.idleMinutes} min`;
        case 'SkipSleeping': return draft.skipSleeping ? 'yes' : 'no';
    }
};

/** Why a rule pays nothing, or null when it pays. */
const problemOf = (rule: Rule, rules: Rule[], currencies: string[] | null) => {
    if (rule.Currency === '') return 'Pick a currency.';

    if (currencies && !currencies.some(x => x.toLowerCase() === rule.Currency.toLowerCase())) return `The hotel has no currency called ${rule.Currency}.`;

    if (rules.findIndex(x => x.Currency.toLowerCase() === rule.Currency.toLowerCase()) !== rules.indexOf(rule)) return 'Another rule pays this currency already; only the first one counts.';

    if (rule.Amount <= 0) return 'The amount must be at least 1.';

    if (rule.IntervalMinutes <= 0) return 'Every must be at least 1 minute.';

    return null;
};

/** A whole number at least `min`, kept as typed until it is one. */
const Count = ({ value, onChange, min, label, disabled }: { value: number; onChange: (value: number) => void; min: number; label: string; disabled?: boolean }) => {
    const [ text, setText ] = useState(String(value));
    const [ was, setWas ] = useState(value);

    if (value !== was) {
        setWas(value);
        setText(String(value));
    }

    return (
        <Input
            type="number"
            inputMode="numeric"
            step={1}
            min={min}
            aria-label={label}
            disabled={disabled}
            value={text}
            onChange={(event) => {
                const typed = event.target.value;
                const number = Number(typed);

                setText(typed);

                if (typed.trim() !== '' && Number.isInteger(number) && number >= min) onChange(number);
            }}
            className="w-24"
        />
    );
};

/** The rules, one row each, changed in place. */
const RulesTable = ({ rules, currencies, disabled, onChange }: { rules: Rule[]; currencies: string[] | null; disabled: boolean; onChange: (rules: Rule[]) => void }) => {
    const set = (index: number, change: Partial<Rule>) => onChange(rules.map((rule, i) => (i === index ? { ...rule, ...change } : rule)));
    const unused = currencies?.filter(name => !rules.some(x => x.Currency.toLowerCase() === name.toLowerCase())) ?? [];

    return (
        <>
            {rules.length === 0
                ? <EmptyState>No rules yet: nothing is paid. Add one for each currency to pay.</EmptyState>
                : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr>
                                        <Th>Currency</Th>
                                        <Th>Amount</Th>
                                        <Th>Every (minutes)</Th>
                                        <Th>HC bonus</Th>
                                        <Th>Daily cap</Th>
                                        <Th>On</Th>
                                        <Th><span className="sr-only">Remove</span></Th>
                                    </tr>
                                </thead>
                                <tbody className="[&>tr:last-child>td]:border-b-0">
                                    {rules.map((rule, index) => {
                                        const problem = problemOf(rule, rules, currencies);

                                        return (
                                            // A rule has no id of its own: its place in the list is what the server keeps.
                                            <tr key={index}>
                                                <Td>
                                                    {currencies
                                                        ? (
                                                                <Select value={rule.Currency} disabled={disabled} aria-label="Currency" onChange={event => set(index, { Currency: event.target.value })} className="w-36">
                                                                    {rule.Currency === '' && <option value="">Pick one</option>}
                                                                    {!currencies.includes(rule.Currency) && rule.Currency !== '' && <option value={rule.Currency}>{rule.Currency}</option>}
                                                                    {currencies.map(name => <option key={name} value={name}>{name}</option>)}
                                                                </Select>
                                                            )
                                                        : <Input value={rule.Currency} disabled={disabled} aria-label="Currency" onChange={event => set(index, { Currency: event.target.value.trim() })} className="w-36 font-mono" />}
                                                    {problem && <span className="mt-1 block text-xs text-warn">{problem}</span>}
                                                </Td>
                                                <Td><Count label="Amount" value={rule.Amount} min={1} disabled={disabled} onChange={Amount => set(index, { Amount })} /></Td>
                                                <Td><Count label="Every (minutes)" value={rule.IntervalMinutes} min={1} disabled={disabled} onChange={IntervalMinutes => set(index, { IntervalMinutes })} /></Td>
                                                <Td><Count label="HC bonus" value={rule.HcBonus} min={0} disabled={disabled} onChange={HcBonus => set(index, { HcBonus })} /></Td>
                                                <Td><Count label="Daily cap" value={rule.DailyCap} min={0} disabled={disabled} onChange={DailyCap => set(index, { DailyCap })} /></Td>
                                                <Td><Switch label={<span className="sr-only">On</span>} checked={rule.Enabled} disabled={disabled} onChange={Enabled => set(index, { Enabled })} className="min-h-0" /></Td>
                                                <Td><IconButton label="Remove this rule" icon={<Trash2 />} tone="bad" disabled={disabled} onClick={() => onChange(rules.filter((_, i) => i !== index))} /></Td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
            {!disabled && (currencies === null || unused.length > 0) && (
                <div className="border-t border-line p-3">
                    <Button
                        variant="ghost"
                        icon={<Plus />}
                        onClick={() => onChange([ ...rules, { Currency: unused[0] ?? '', Amount: 5, IntervalMinutes: 15, HcBonus: 0, DailyCap: 0, Enabled: true } ])}
                    >
                        Add a rule
                    </Button>
                </div>
            )}
        </>
    );
};

/** The setup, started from what is configured now. */
const OnlineRewardsForm = ({ settings, canManage }: { settings: Record<Name, ServerSetting>; canManage: boolean }) => {
    const start = useMemo(() => draftOf(settings), [ settings ]);
    const [ draft, setDraft ] = useState(start);
    const { data: currencyData } = useCurrencies();
    const currencies = currencyData ? currencyData.items.filter(x => x.enabled).map(x => x.name) : null;
    const save = useSaveSetting();
    const reset = useResetSetting();
    const lockedBy = (name: Name) => settings[name].startup || settings[name].source === SOURCE.environment;
    const editable = (name: Name) => canManage && !lockedBy(name);
    const changed = NAMES.filter(name => editable(name) && jsonOf(name, draft) !== jsonOf(name, start));
    const setHere = NAMES.filter(name => settings[name].source === SOURCE.panel);
    const busy = save.isPending || reset.isPending;
    const set = (change: Partial<Draft>) => setDraft({ ...draft, ...change });

    const submit = async () => {
        for (const name of changed) await save.mutateAsync({ path: pathOf(name), value: jsonOf(name, draft) });

        toast('Saved the online rewards. They apply from each player\'s next payout.');
    };

    const putBack = () => ask(
        { title: 'Put the online rewards back to what appsettings.json says?', body: 'It applies at once.', confirm: 'Put back' },
        async () => {
            for (const name of setHere) await reset.mutateAsync(pathOf(name));
        },
    );

    return (
        <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
            {NAMES.some(lockedBy) && <WarningNotice>Some of these are set in the environment, which always wins over the panel. Change them there.</WarningNotice>}
            <Panel
                title="Pay players for time online"
                description={<>Not part of Habbo: off unless you turn it on. Also under <Link to={`/settings?q=${encodeURIComponent(SECTION)}`} className="underline-offset-2 hover:underline">Settings</Link>.</>}
            >
                <div className="p-4">
                    <Switch
                        label="Online rewards"
                        hint={draft.enabled ? 'On: every player online is paid by the rules below.' : 'Off: nobody is paid. The rules are kept for when it is on.'}
                        checked={draft.enabled}
                        disabled={!editable('Enabled')}
                        onChange={enabled => set({ enabled })}
                    />
                </div>
            </Panel>
            <Panel
                title="Rules"
                description="One rule per currency. Each player's clock starts when they log in, so a rule of 15 minutes pays at 15, 30 and 45 minutes online, and so on. Time offline, or while this was off, is never paid afterwards."
                className="overflow-clip"
            >
                <RulesTable rules={draft.rules} currencies={currencies} disabled={!editable('Rules')} onChange={rules => set({ rules })} />
                <dl className="grid gap-x-4 gap-y-1 border-t border-line p-4 text-xs text-muted sm:grid-cols-[8rem_1fr]">
                    <dt className="font-medium">Amount</dt>
                    <dd>What each payout gives, at most Turbo:Operations:MaxCurrencyAmount.</dd>
                    <dt className="font-medium">HC bonus</dt>
                    <dd>Added for a player in Habbo Club.</dd>
                    <dt className="font-medium">Daily cap</dt>
                    <dd>The most one player gets from the rule in a day (UTC), however often they log in. 0 for no limit.</dd>
                </dl>
            </Panel>
            <Panel title="Idle players" description="A player who is away when a payout comes round misses that one.">
                <div className="flex flex-col gap-3 p-4">
                    <Labeled label="Idle after (minutes)" hint="Not paid after this long without doing anything: walking, chatting, clicking. The client's own timers don't count. 0 to leave it to the room's sleep alone.">
                        <Count label="Idle after (minutes)" value={draft.idleMinutes} min={0} disabled={!editable('IdleMinutes')} onChange={idleMinutes => set({ idleMinutes })} />
                    </Labeled>
                    <Switch
                        label="Skip sleeping avatars"
                        hint="Not paid while their avatar sleeps in its room: the room's idle sleep, or one who chose to sleep."
                        checked={draft.skipSleeping}
                        disabled={!editable('SkipSleeping')}
                        onChange={skipSleeping => set({ skipSleeping })}
                    />
                    <p className="text-xs text-muted">
                        Each payout is in the <Link to={`/currency-log?${new URLSearchParams({ cause: 'reward.online' })}`} className="text-accent hover:underline">Currency log</Link> as reward.online.
                    </p>
                </div>
            </Panel>
            {canManage && (
                <Panel className="sticky bottom-3 z-10 shadow-lg">
                    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1 text-xs">
                            {changed.length === 0
                                ? <span className="text-muted">No changes. Changes apply at once.</span>
                                : (
                                        <ul className="flex flex-wrap gap-x-3 gap-y-1">
                                            {changed.map(name => (
                                                <li key={name}>
                                                    <span className="text-muted">{LABELS[name]}</span>
                                                    {' '}
                                                    <span className="font-mono">{shownOf(name, start)} → {shownOf(name, draft)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {setHere.length > 0 && <Button variant="ghost" icon={<RotateCcw />} disabled={busy} onClick={putBack}>Put back</Button>}
                            {changed.length > 0 && <Button variant="ghost" icon={<Undo2 />} disabled={busy} onClick={() => setDraft(start)}>Discard</Button>}
                            <Button icon={<Save />} disabled={busy || changed.length === 0} onClick={() => void submit()}>Save{changed.length > 0 ? ` ${changed.length}` : ''}</Button>
                        </div>
                    </div>
                    {(save.error || reset.error) && <div className="px-3 pb-3"><ErrorNotice error={save.error ?? reset.error} /></div>}
                </Panel>
            )}
        </div>
    );
};

/**
 * Currency for time online (`Turbo:OnlineRewards`): every so many minutes of a player's session,
 * the rule's amount of a currency. Saved through the server's settings, so it applies at once.
 */
export const OnlineRewardsPage = () => {
    const { data, error } = useSettings();

    const settings = useMemo(() => {
        const found = Object.fromEntries((data?.settings ?? []).filter(x => x.section === SECTION).map(x => [ x.path.slice(SECTION.length + 1), x ]));

        return NAMES.every(name => found[name]) ? found as Record<Name, ServerSetting> : null;
    }, [ data ]);

    // The form starts again from what the server has after a save or a put back.
    const version = settings ? NAMES.map(name => `${settings[name].value}|${settings[name].source}`).join(';') : '';

    return (
        <>
            <PageHeader title="Online rewards" description="Currency paid to players for time online" />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!error && !data && <Loading />}
                {data && !settings && <ErrorNotice error={new Error(`The server has no ${SECTION} settings: it is older than this panel.`)} />}
                {data && settings && <OnlineRewardsForm key={version} settings={settings} canManage={data.canManage} />}
            </PageBody>
        </>
    );
};
