import { Coins, Gem, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { type Currency, type CurrencyInput, type CurrencyKind, useCurrencies, useDeleteCurrency, useSaveCurrency } from '#/api/content';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Select, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';

const KINDS: { value: CurrencyKind; label: string }[] = [
    { value: 'credits', label: 'Credits' },
    { value: 'activity_points', label: 'Activity points' },
    { value: 'silver', label: 'Silver' },
    { value: 'emeralds', label: 'Emeralds' },
];

/** The activity point numbers the client knows by name. */
const KNOWN_POINTS: Record<number, string> = { 0: 'duckets', 5: 'diamonds' };

const ICONS: Record<CurrencyKind, ReactNode> = {
    credits: <Coins />,
    activity_points: <Sparkles />,
    silver: <Coins />,
    emeralds: <Gem />,
};

/** What a currency is, in words: "Activity points 5 (diamonds)". */
const kindOf = (currency: { type: CurrencyKind; activityPointType: number | null }) => {
    const label = KINDS.find(x => x.value === currency.type)?.label ?? currency.type;

    if (currency.type !== 'activity_points' || currency.activityPointType === null)
        return label;

    const known = KNOWN_POINTS[currency.activityPointType];

    return `${label} ${currency.activityPointType}${known ? ` (${known})` : ''}`;
};

/** What uses a currency, as the few words worth showing. */
const usesOf = (currency: Currency) => [
    currency.holders > 0 && `${currency.holders.toLocaleString()} ${currency.holders === 1 ? 'player holds it' : 'players hold it'}`,
    currency.offers > 0 && `${currency.offers.toLocaleString()} ${currency.offers === 1 ? 'offer' : 'offers'}`,
    currency.vouchers > 0 && `${currency.vouchers.toLocaleString()} ${currency.vouchers === 1 ? 'voucher' : 'vouchers'}`,
].filter((x): x is string => !!x);

/**
 * A currency to add or change. A currency in use keeps its kind: balances, prices and vouchers are
 * kept in it, so only its name and whether it is on can change.
 */
const CurrencyForm = ({ start, locked, busy, onSave, onCancel }: { start: CurrencyInput; locked: boolean; busy: boolean; onSave: (input: CurrencyInput) => void; onCancel: () => void }) => {
    const [ draft, setDraft ] = useState(start);
    const points = draft.type === 'activity_points';

    return (
        <form
            className="flex flex-col gap-3 border-t border-line bg-subtle/40 px-4 py-4"
            onSubmit={(event) => {
                event.preventDefault();
                onSave({ ...draft, name: draft.name.trim().toLowerCase(), activityPointType: points ? draft.activityPointType : null });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_9rem]">
                <Labeled label="Name" hint="How :give names it.">
                    <Input
                        value={draft.name}
                        onChange={event => setDraft({ ...draft, name: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                        maxLength={32}
                        placeholder="snowflakes"
                        spellCheck={false}
                        autoComplete="off"
                        className="w-full font-mono"
                        required
                    />
                </Labeled>
                <Labeled label="Kind" hint={locked ? 'In use, so its kind stays.' : undefined}>
                    <Select value={draft.type} onChange={event => setDraft({ ...draft, type: event.target.value as CurrencyKind })} disabled={locked} className="w-full">
                        {KINDS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}
                    </Select>
                </Labeled>
                {points && (
                    <Labeled label="Points number" hint="0 duckets, 5 diamonds.">
                        <Input
                            value={draft.activityPointType ?? ''}
                            onChange={event => setDraft({ ...draft, activityPointType: event.target.value === '' ? null : Number(event.target.value.replace(/\D/g, '')) })}
                            inputMode="numeric"
                            disabled={locked}
                            className="w-full font-mono"
                            required
                        />
                    </Labeled>
                )}
            </div>
            <Switch
                label="On"
                hint="Off, :give and vouchers can't use it; balances are kept."
                checked={draft.enabled}
                onChange={enabled => setDraft({ ...draft, enabled })}
                disabled={draft.type === 'credits'}
                className="sm:max-w-md"
            />
            <div className="flex flex-wrap gap-2 max-sm:flex-col-reverse">
                <Button variant="secondary" onClick={onCancel}>Cancel</Button>
                <Button type="submit" disabled={busy || draft.name.trim() === ''}>Save</Button>
            </div>
        </form>
    );
};

const CurrencyRow = ({ currency, canManage, editing, onEdit, onDone }: { currency: Currency; canManage: boolean; editing: boolean; onEdit: () => void; onDone: () => void }) => {
    const save = useSaveCurrency();
    const remove = useDeleteCurrency();
    const uses = usesOf(currency);
    const credits = currency.type === 'credits';

    const store = (input: CurrencyInput) => save.mutate({ id: currency.id, input }, {
        onSuccess: () => {
            toast(`Saved ${input.name}.`);
            onDone();
        },
        onError: toastError,
    });

    return (
        <li>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl [&>svg]:size-5', currency.enabled ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted')}>
                    {ICONS[currency.type]}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{currency.name}</span>
                        {!currency.enabled && <Badge>off</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted">
                        {kindOf(currency)}
                        {` · ${uses.length > 0 ? uses.join(' · ') : 'nothing uses it'}`}
                    </div>
                </div>
                {canManage && (
                    <div className="flex items-center gap-1">
                        <Switch
                            label={<span className="sr-only">{currency.enabled ? 'On' : 'Off'}</span>}
                            checked={currency.enabled}
                            disabled={credits || save.isPending}
                            onChange={enabled => store({ name: currency.name, type: currency.type, activityPointType: currency.activityPointType, enabled })}
                        />
                        <IconButton label={`Edit ${currency.name}`} icon={<Pencil />} onClick={onEdit} />
                        {/* A place kept for it on every row, so each row's switch and pencil line up. */}
                        {(credits || uses.length > 0) && <span aria-hidden className="size-10 shrink-0 sm:size-8" />}
                        {!credits && uses.length === 0 && (
                            <IconButton
                                label={`Delete ${currency.name}`}
                                icon={<Trash2 />}
                                tone="bad"
                                disabled={remove.isPending}
                                onClick={() => ask({ title: `Delete the currency ${currency.name}?`, body: 'Nothing uses it, so nothing else changes.', confirm: 'Delete' }, () => remove.mutate(currency.id, {
                                    onSuccess: () => toast(`Deleted ${currency.name}.`),
                                    onError: toastError,
                                }))}
                            />
                        )}
                    </div>
                )}
            </div>
            {editing && (
                <CurrencyForm
                    start={{ name: currency.name, type: currency.type, activityPointType: currency.activityPointType, enabled: currency.enabled }}
                    locked={uses.length > 0}
                    busy={save.isPending}
                    onSave={store}
                    onCancel={onDone}
                />
            )}
        </li>
    );
};

/**
 * The hotel's currencies: credits, and each kind of activity points the client shows by its
 * number (duckets, diamonds, a seasonal one). Added, renamed and turned on or off here; the
 * server's wallets, vouchers and :give use a change at once. One in use keeps its kind and can
 * only be turned off, never deleted.
 */
export const CurrenciesTab = ({ canManage }: { canManage: boolean }) => {
    const { data, error } = useCurrencies();
    const save = useSaveCurrency();
    const [ editing, setEditing ] = useState<number | 'new' | null>(null);

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    const next = Math.max(100, ...data.items.map(x => x.activityPointType ?? 0)) + 1;

    return (
        <Panel
            title="Currencies"
            description="What wallets hold, what the catalog prices in and what vouchers give. A currency in use keeps its kind; turn it off instead of deleting it."
            actions={canManage && editing !== 'new' && <Button icon={<Plus />} onClick={() => setEditing('new')}>Add currency</Button>}
            className="overflow-clip"
        >
            {editing === 'new' && (
                <CurrencyForm
                    start={{ name: '', type: 'activity_points', activityPointType: next, enabled: true }}
                    locked={false}
                    busy={save.isPending}
                    onSave={input => save.mutate({ id: null, input }, {
                        onSuccess: () => {
                            toast(`Added ${input.name}.`);
                            setEditing(null);
                        },
                        onError: toastError,
                    })}
                    onCancel={() => setEditing(null)}
                />
            )}
            {data.items.length === 0
                ? <EmptyState>No currencies.</EmptyState>
                : (
                        <ul className="divide-y divide-line border-t border-line">
                            {data.items.map(currency => (
                                <CurrencyRow
                                    key={currency.id}
                                    currency={currency}
                                    canManage={canManage}
                                    editing={editing === currency.id}
                                    onEdit={() => setEditing(editing === currency.id ? null : currency.id)}
                                    onDone={() => setEditing(null)}
                                />
                            ))}
                        </ul>
                    )}
        </Panel>
    );
};
