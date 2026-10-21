import { Save, Sparkles, Trash2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { catalogCalls, type CatalogLimited, type CatalogLimitedInput, useCatalogEdit } from '#/api/catalog';
import { ask } from '#/components/confirm';
import { Button, ErrorNotice, Input, Labeled, Switch } from '#/components/ui';

/** A UTC time as a datetime-local input shows it, in the viewer's own time. */
const toLocal = (utc: string | null) => {
    if (!utc)
        return '';

    const at = new Date(utc);

    return new Date(at.getTime() - at.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

/** A datetime-local value back to UTC. */
const toUtc = (local: string) => (local ? new Date(local).toISOString() : null);

const inputOf = (limited: CatalogLimited | null): CatalogLimitedInput => ({
    totalQuantity: limited?.total ?? 100,
    raffleWindowSeconds: limited?.raffleWindowSeconds ?? 30,
    startsAtUtc: limited?.startsAtUtc ?? null,
    endsAtUtc: limited?.endsAtUtc ?? null,
    active: limited?.active ?? true,
});

/**
 * An offer's limited series: how many there are and how many are left, how long the opening raffle
 * gathers buyers before it draws (0 sells first come, first served), when it is on sale, and
 * whether it is. A new total moves what is left by as much; it can't drop below what is sold.
 */
export const LimitedSection = ({ offerId, limited, canManage }: { offerId: number; limited: CatalogLimited | null; canManage: boolean }) => {
    const [ open, setOpen ] = useState(limited !== null);
    const [ draft, setDraft ] = useState(() => inputOf(limited));
    const save = useCatalogEdit(catalogCalls.saveLimited);
    const remove = useCatalogEdit(catalogCalls.removeLimited);
    const sold = limited ? limited.total - limited.remaining : 0;
    // What the raffle has a record of, entered or won, comes off only with the series' sales.
    const hasSales = sold > 0 || limited?.raffleFinished === true;

    if (!open)
        return canManage
            ? <Button variant="secondary" icon={<Sparkles />} onClick={() => setOpen(true)} className="self-start">Make it limited</Button>
            : null;

    const set = <K extends keyof CatalogLimitedInput>(key: K, value: CatalogLimitedInput[K]) => setDraft({ ...draft, [key]: value });

    const removeWithSales = () => ask({
        title: 'Remove the series with its sales?',
        body: `The series, its raffle entries and the record of the ${sold.toLocaleString()} sold are taken away for good, and an undo does not bring them back. It stops selling at once; publish to take it off the page. Furni players already have stays theirs, with its serial.`,
        confirm: 'Remove',
    }, () => remove.mutate([ offerId, true ]));

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        save.mutate([ offerId, draft ]);
    };

    return (
        <div className="flex flex-col gap-3 rounded-lg border border-warn-line bg-warn-soft/40 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold">Limited series</span>
                {limited && (
                    <span className="font-mono text-xs text-muted">
                        {limited.remaining.toLocaleString()} of {limited.total.toLocaleString()} left · {sold.toLocaleString()} sold
                        {limited.raffleFinished ? ' · raffle drawn' : ''}
                    </span>
                )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="How many" hint={sold > 0 ? `At least ${sold}, what is sold.` : undefined}>
                    <Input type="number" min={Math.max(1, sold)} value={draft.totalQuantity} onChange={event => set('totalQuantity', Number(event.target.value) || 0)} disabled={!canManage} className="font-mono" aria-label="How many" />
                </Labeled>
                <Labeled label="Raffle window (seconds)" hint="Buyers in the first this-many seconds are drawn; 0 is first come, first served.">
                    <Input type="number" min={0} max={3600} value={draft.raffleWindowSeconds} onChange={event => set('raffleWindowSeconds', Number(event.target.value) || 0)} disabled={!canManage} className="font-mono" aria-label="Raffle window" />
                </Labeled>
                <Labeled label="On sale from" hint="Empty: now. A later time shows as the next limited item.">
                    <Input type="datetime-local" value={toLocal(draft.startsAtUtc)} onChange={event => set('startsAtUtc', toUtc(event.target.value))} disabled={!canManage} aria-label="On sale from" />
                </Labeled>
                <Labeled label="Until" hint="Empty: until it is sold out.">
                    <Input type="datetime-local" value={toLocal(draft.endsAtUtc)} onChange={event => set('endsAtUtc', toUtc(event.target.value))} disabled={!canManage} aria-label="Until" />
                </Labeled>
            </div>
            <Switch label="On sale" checked={draft.active} onChange={value => set('active', value)} disabled={!canManage} />
            {(save.error ?? remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
            {save.isSuccess && <p className="text-xs text-good">Saved. Publish to show it to players.</p>}
            {canManage && (
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" icon={<Save />} disabled={save.isPending} onClick={handleSubmit}>{limited ? 'Save series' : 'Make limited'}</Button>
                    {limited
                        ? !hasSales
                                ? <Button variant="ghost" icon={<Trash2 />} disabled={remove.isPending} onClick={() => remove.mutate([ offerId, false ])}>No longer limited</Button>
                                : <Button variant="ghost" icon={<Trash2 />} disabled={remove.isPending} onClick={removeWithSales}>Remove with its sales</Button>
                        : <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>}
                </div>
            )}
        </div>
    );
};
