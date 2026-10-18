import { RotateCcw, Save } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { type ServerSetting, SOURCE, useResetSetting, useSaveSetting, useSettings } from '#/api/settings';
import { ask } from '#/components/confirm';
import { RestartServer } from '#/components/RestartServer';
import { toast } from '#/components/toast';
import { Button, ErrorNotice, Field, Input, Labeled, Loading, PageBody, PageHeader, Panel, Textarea, WarningNotice } from '#/components/ui';

import { catalogTabs } from './catalogTabs';

const SECTION = 'Turbo:Catalog:BundleDiscount';

/** The ruleset's settings, in the order the form shows them. */
const NAMES = [ 'MaxPurchaseSize', 'BundleSize', 'BundleDiscountSize', 'BonusThreshold', 'AdditionalBonusDiscountThresholdQuantities' ] as const;

type Name = typeof NAMES[number];

interface Ruleset {
    maxPurchaseSize: number;
    bundleSize: number;
    bundleDiscountSize: number;
    bonusThreshold: number;
    thresholds: number[];
}

type Draft = Record<Name, string>;

const pathOf = (name: Name) => `${SECTION}:${name}`;

/** A list as staff type it: numbers apart by commas or spaces. */
const listText = (json: string | null) => {
    try {
        const value: unknown = JSON.parse(json ?? '[]');

        return Array.isArray(value) ? value.join(', ') : '';
    } catch {
        return '';
    }
};

const isWhole = (text: string) => text.trim() !== '' && Number.isInteger(Number(text));

const numbersOf = (text: string) => text.split(/[\s,]+/).filter(x => x !== '');

/** What the draft would save, or why it can't be. */
const rulesetOf = (draft: Draft): Ruleset | string => {
    for (const name of NAMES.slice(0, 4))
        if (!isWhole(draft[name])) return 'Every field but the list is a whole number.';

    const thresholds = numbersOf(draft.AdditionalBonusDiscountThresholdQuantities);

    if (thresholds.some(x => !isWhole(x) || Number(x) < 1)) return 'The extra free items are quantities: whole numbers from 1 up.';

    if (Number(draft.MaxPurchaseSize) < 1) return 'At least one has to be bought at once.';

    return {
        maxPurchaseSize: Number(draft.MaxPurchaseSize),
        bundleSize: Number(draft.BundleSize),
        bundleDiscountSize: Number(draft.BundleDiscountSize),
        bonusThreshold: Number(draft.BonusThreshold),
        thresholds: thresholds.map(Number).sort((a, b) => a - b),
    };
};

/** The JSON the server saves for one setting of the ruleset. */
const jsonOf = (name: Name, ruleset: Ruleset) => {
    switch (name) {
        case 'MaxPurchaseSize': return String(ruleset.maxPurchaseSize);
        case 'BundleSize': return String(ruleset.bundleSize);
        case 'BundleDiscountSize': return String(ruleset.bundleDiscountSize);
        case 'BonusThreshold': return String(ruleset.bonusThreshold);
        case 'AdditionalBonusDiscountThresholdQuantities': return JSON.stringify(ruleset.thresholds);
    }
};

/**
 * The free items the client's spinner shows for a quantity (`HabboCatalogUtils.getDiscountItemsCount`):
 * one lot per whole bundle, a bonus from `bonusThreshold` bundles up, and one per listed quantity reached.
 */
const freeItems = (ruleset: Ruleset, quantity: number) => {
    let free = ruleset.thresholds.filter(x => quantity >= x).length;

    if (ruleset.bundleSize <= 0) return free;

    const bundles = Math.trunc(quantity / ruleset.bundleSize);

    free += bundles * ruleset.bundleDiscountSize;

    if (bundles >= ruleset.bonusThreshold) {
        if (quantity % ruleset.bundleSize === ruleset.bundleSize - 1) free++;

        free += bundles - ruleset.bonusThreshold;
    }

    return free;
};

/** The quantities at which the free items go up, to the most bought at once. */
const steps = (ruleset: Ruleset) => {
    const found: { quantity: number; free: number }[] = [];
    let last = freeItems(ruleset, 0);

    for (let quantity = 1; quantity <= Math.min(ruleset.maxPurchaseSize, 1000); quantity++) {
        const free = freeItems(ruleset, quantity);

        if (free !== last) found.push({ quantity, free });

        last = free;
    }

    return found;
};

const Preview = ({ ruleset }: { ruleset: Ruleset }) => {
    const [ quantity, setQuantity ] = useState(Math.min(10, ruleset.maxPurchaseSize));
    const shown = Math.max(1, Math.min(quantity, ruleset.maxPurchaseSize));
    const changes = useMemo(() => steps(ruleset), [ ruleset ]);

    return (
        <Panel title="What the client shows" description="The spinner's bonus line, worked out as the client does from the values above, saved or not.">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-end gap-4">
                    <Labeled label="Quantity" className="w-32">
                        <Input type="number" min={1} max={ruleset.maxPurchaseSize} value={quantity} onChange={event => setQuantity(Number(event.target.value))} />
                    </Labeled>
                    <p className="pb-2 text-sm">
                        Buying <strong>{shown}</strong> shows <strong>{freeItems(ruleset, shown)}</strong> free.
                    </p>
                </div>
                {changes.length === 0
                    ? <p className="text-sm text-muted">No quantity up to {ruleset.maxPurchaseSize} shows a free item.</p>
                    : (
                            <div className="flex flex-col gap-1.5">
                                <span className="text-xs font-medium text-muted">Where it goes up</span>
                                <ul className="flex flex-wrap gap-1.5">
                                    {changes.map(change => (
                                        <li key={change.quantity} className="rounded-md border border-line px-2 py-1 font-mono text-xs">
                                            {change.quantity}
                                            <span className="text-muted"> → {change.free}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
            </div>
        </Panel>
    );
};

/** The ruleset's form, started from what is configured now. */
const DiscountForm = ({ settings, canManage }: { settings: Record<Name, ServerSetting>; canManage: boolean }) => {
    const start = useMemo(() => Object.fromEntries(NAMES.map(name => [ name, name === 'AdditionalBonusDiscountThresholdQuantities' ? listText(settings[name].value) : (settings[name].value ?? '') ])) as Draft, [ settings ]);
    const [ draft, setDraft ] = useState(start);
    const save = useSaveSetting();
    const reset = useResetSetting();
    const ruleset = rulesetOf(draft);
    const lockedBy = (name: Name) => settings[name].startup || settings[name].source === SOURCE.environment;
    const editable = (name: Name) => canManage && !lockedBy(name);
    const changed = typeof ruleset === 'string' ? [] : NAMES.filter(name => editable(name) && jsonOf(name, ruleset) !== settings[name].value);
    const setHere = NAMES.filter(name => settings[name].source === SOURCE.panel);
    const live = NAMES.every(name => settings[name].live);
    const busy = save.isPending || reset.isPending;

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (typeof ruleset === 'string') return;

        for (const name of changed) await save.mutateAsync({ path: pathOf(name), value: jsonOf(name, ruleset) });

        toast(live ? 'Saved the bundle discounts.' : 'Saved the bundle discounts: they apply after a restart.');
    };

    const putBack = () => ask(
        { title: 'Put the bundle discounts back to what appsettings.json says?', body: live ? 'It applies at once.' : 'It applies after a restart.', confirm: 'Put back' },
        async () => {
            for (const name of setHere) await reset.mutateAsync(pathOf(name));
        },
    );

    const field = (name: Name, label: string, hint: string, min?: number) => (
        <Field
            label={label}
            hint={hint}
            name={name}
            type="number"
            step={1}
            min={min}
            value={draft[name]}
            onChange={event => setDraft({ ...draft, [name]: event.target.value })}
            disabled={!editable(name)}
            title={settings[name].source === SOURCE.environment ? `${settings[name].sourceName} sets this` : undefined}
        />
    );

    return (
        <>
            <Panel title="Bulk buying" description={<>How many of an offer can be bought at once, and the free items a purchase gives on top. Also under <Link to={`/settings?q=${encodeURIComponent(SECTION)}`} className="underline-offset-2 hover:underline">Settings</Link>.</>}>
                <form className="flex flex-col gap-4 p-4" onSubmit={event => void submit(event)}>
                    {NAMES.some(lockedBy) && <WarningNotice>Some of these are set in the environment, which always wins over the panel. Change them there.</WarningNotice>}
                    <div className="grid gap-4 sm:grid-cols-2">
                        {field('MaxPurchaseSize', 'Most at once', 'The spinner stops here, and a bigger order is refused. Only offers that can be bundled go past one.', 1)}
                        {field('BundleSize', 'Bundle size', 'Items to a bundle. 0 turns bundles off, and the two fields below with them.', 0)}
                        {field('BundleDiscountSize', 'Free per bundle', 'Free items for each whole bundle.', 0)}
                        {field('BonusThreshold', 'Bonus from', 'From this many whole bundles, one more free per bundle past it, and one for a bundle an item short.')}
                    </div>
                    <Labeled label="Extra free item at" hint="One more free item at each quantity listed. List a quantity twice for two.">
                        <Textarea
                            name="AdditionalBonusDiscountThresholdQuantities"
                            rows={3}
                            value={draft.AdditionalBonusDiscountThresholdQuantities}
                            onChange={event => setDraft({ ...draft, AdditionalBonusDiscountThresholdQuantities: event.target.value })}
                            disabled={!editable('AdditionalBonusDiscountThresholdQuantities')}
                            placeholder="5, 9, 9, 13"
                            className="font-mono text-xs"
                        />
                    </Labeled>
                    <p className="text-xs text-muted">The client shows the free items next to its spinner and in the confirmation. A purchase charges for the quantity bought and gives the free items on top. The builders club has none.</p>
                    {typeof ruleset === 'string' && <p className="text-xs text-warn">{ruleset}</p>}
                    {canManage && (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button type="submit" icon={<Save />} disabled={busy || changed.length === 0}>Save</Button>
                            {setHere.length > 0 && <Button variant="ghost" icon={<RotateCcw />} disabled={busy} onClick={putBack}>Put back</Button>}
                            <span className="text-xs text-muted">{live ? 'Applies at once.' : 'Applies after a restart.'}</span>
                        </div>
                    )}
                    {(save.error || reset.error) && <ErrorNotice error={save.error ?? reset.error} />}
                </form>
            </Panel>
            {typeof ruleset !== 'string' && <Preview ruleset={ruleset} />}
        </>
    );
};

/**
 * The catalog's bulk-buy ruleset (`Turbo:Catalog:BundleDiscount`): the most of an offer bought at
 * once and the free items the client's spinner counts, changed through the server's settings.
 */
export const DiscountsPage = () => {
    const { data, error } = useSettings();

    const settings = useMemo(() => {
        const found = Object.fromEntries((data?.settings ?? []).filter(x => x.section === SECTION).map(x => [ x.path.slice(SECTION.length + 1), x ]));

        return NAMES.every(name => found[name]) ? found as Record<Name, ServerSetting> : null;
    }, [ data ]);

    const waiting = settings ? NAMES.some(name => settings[name].pendingRestart) : false;
    // The form starts again from what the server has after a save or a put back.
    const version = settings ? NAMES.map(name => `${settings[name].value}|${settings[name].source}`).join(';') : '';

    return (
        <>
            <PageHeader title="Catalog" tabs={catalogTabs('discounts')} description="Bulk buying and the free items it shows" />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!error && !data && <Loading />}
                {data && !settings && <ErrorNotice error={new Error(`The server has no ${SECTION} settings.`)} />}
                {waiting && (
                    <WarningNotice>
                        <div className="flex flex-col gap-3">
                            <span>The server runs with other bundle discounts than these until it restarts.</span>
                            <RestartServer compact />
                        </div>
                    </WarningNotice>
                )}
                {data && settings && <DiscountForm key={version} settings={settings} canManage={data.canManage} />}
            </PageBody>
        </>
    );
};
