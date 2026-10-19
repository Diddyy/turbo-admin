import { Gift, Layers, Plus, RotateCcw, Save, Sparkles, Star, Undo2, X } from 'lucide-react';
import { type KeyboardEvent, type PointerEvent, type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { type ServerSetting, SOURCE, useResetSetting, useSaveSetting, useSettings } from '#/api/settings';
import { ask } from '#/components/confirm';
import { RestartServer } from '#/components/RestartServer';
import { toast } from '#/components/toast';
import { Button, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel, Switch, TextButton, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';

import { catalogTabs } from './catalogTabs';

const SECTION = 'Turbo:Catalog:BundleDiscount';

/** The ruleset's settings, in the order the changes list them. */
const NAMES = [ 'MaxPurchaseSize', 'BundleSize', 'BundleDiscountSize', 'BonusThreshold', 'AdditionalBonusDiscountThresholdQuantities' ] as const;

type Name = typeof NAMES[number];

const LABELS: Record<Name, string> = {
    MaxPurchaseSize: 'Most at once',
    BundleSize: 'Bundle size',
    BundleDiscountSize: 'Free per bundle',
    BonusThreshold: 'Growing bonus from',
    AdditionalBonusDiscountThresholdQuantities: 'Extra free items at',
};

interface Ruleset {
    maxPurchaseSize: number;
    bundleSize: number;
    bundleDiscountSize: number;
    bonusThreshold: number;
    thresholds: number[];
}

/** A growing bonus no order reaches: the bonus off while bundles are on. */
const NO_BONUS = 10000;

/** The most quantities the chart draws. */
const CHART_LIMIT = 200;

const HABBO_THRESHOLDS = [ 5, ...Array.from({ length: 23 }, (_, i) => 9 + i * 4).flatMap(x => [ x, x ]) ];

const PRESETS: { key: string; label: string; hint: string; icon: ReactNode; ruleset: Omit<Ruleset, 'maxPurchaseSize'> }[] = [
    { key: 'habbo', label: 'Habbo\'s', hint: 'One free at 5, then two more every 4 up to 97', icon: <Sparkles />, ruleset: { bundleSize: 0, bundleDiscountSize: 0, bonusThreshold: -1, thresholds: HABBO_THRESHOLDS } },
    { key: 'bundle', label: 'Buy 5, get 1 free', hint: 'One free for every whole 5 bought', icon: <Layers />, ruleset: { bundleSize: 5, bundleDiscountSize: 1, bonusThreshold: NO_BONUS, thresholds: [] } },
    { key: 'none', label: 'No free items', hint: 'Bulk buying at full price', icon: <X />, ruleset: { bundleSize: 0, bundleDiscountSize: 0, bonusThreshold: -1, thresholds: [] } },
];

const pathOf = (name: Name) => `${SECTION}:${name}`;

const sorted = (values: number[]) => [ ...values ].sort((a, b) => a - b);

const parse = (json: string | null, fallback: number) => {
    try {
        const value: unknown = JSON.parse(json ?? '');

        return typeof value === 'number' ? value : fallback;
    } catch {
        return fallback;
    }
};

const parseList = (json: string | null) => {
    try {
        const value: unknown = JSON.parse(json ?? '[]');

        return Array.isArray(value) ? sorted(value.filter((x): x is number => typeof x === 'number')) : [];
    } catch {
        return [];
    }
};

const rulesetOf = (settings: Record<Name, ServerSetting>): Ruleset => ({
    maxPurchaseSize: parse(settings.MaxPurchaseSize.value, 100),
    bundleSize: parse(settings.BundleSize.value, 0),
    bundleDiscountSize: parse(settings.BundleDiscountSize.value, 0),
    bonusThreshold: parse(settings.BonusThreshold.value, -1),
    thresholds: parseList(settings.AdditionalBonusDiscountThresholdQuantities.value),
});

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

/** A setting's value as staff read it in the list of changes. */
const shownOf = (name: Name, ruleset: Ruleset) => {
    if (name === 'AdditionalBonusDiscountThresholdQuantities') return ruleset.thresholds.length === 0 ? 'none' : `${ruleset.thresholds.length} quantities`;

    if (name === 'BonusThreshold' && ruleset.bonusThreshold >= NO_BONUS) return 'off';

    return jsonOf(name, ruleset);
};

/**
 * The free items the client's spinner shows for a quantity, part by part
 * (`HabboCatalogUtils.getDiscountItemsCount`), as the server gives them on a purchase.
 */
const breakdown = (ruleset: Ruleset, quantity: number) => {
    const extras = ruleset.thresholds.filter(x => quantity >= x);
    let bundles = 0;
    let bonus = 0;

    if (ruleset.bundleSize > 0) {
        const whole = Math.trunc(quantity / ruleset.bundleSize);

        bundles = whole * ruleset.bundleDiscountSize;

        if (whole >= ruleset.bonusThreshold) bonus = whole - ruleset.bonusThreshold + (quantity % ruleset.bundleSize === ruleset.bundleSize - 1 ? 1 : 0);
    }

    return { bundles, bonus, extras, total: bundles + bonus + extras.length };
};

const freeItems = (ruleset: Ruleset, quantity: number) => breakdown(ruleset, quantity).total;

/** The first quantity past this one that gives more free items; null when none to the most at once does. */
const nextFree = (ruleset: Ruleset, quantity: number) => {
    const now = freeItems(ruleset, quantity);

    for (let q = quantity + 1; q <= ruleset.maxPurchaseSize; q++) {
        const free = freeItems(ruleset, q);

        if (free > now) return { quantity: q, free };
    }

    return null;
};

const sameRuleset = (a: Omit<Ruleset, 'maxPurchaseSize'>, b: Ruleset) =>
    a.bundleSize === b.bundleSize
    && a.bundleDiscountSize === b.bundleDiscountSize
    && (a.bundleSize === 0 || a.bonusThreshold === b.bonusThreshold)
    && a.thresholds.join() === b.thresholds.join();

/** A whole number typed in place: kept as typed until it is one in range, put back on leaving. */
const Count = ({ value, onChange, min, max, label, disabled, className }: { value: number; onChange: (value: number) => void; min: number; max?: number; label: string; disabled?: boolean; className?: string }) => {
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
            max={max}
            aria-label={label}
            disabled={disabled}
            value={text}
            onChange={(event) => {
                const typed = event.target.value;
                const number = Number(typed);

                setText(typed);

                if (typed.trim() !== '' && Number.isInteger(number) && number >= min && (max === undefined || number <= max)) onChange(number);
            }}
            onBlur={() => setText(String(value))}
            className={cx('text-center font-mono', className ?? 'w-20')}
        />
    );
};

/** One step of the setup: a number, a title, what it does, and its controls. */
const Step = ({ number, title, hint, aside, children }: { number: number; title: string; hint: ReactNode; aside?: ReactNode; children?: ReactNode }) => (
    <section className="flex gap-3 p-4">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">{number}</span>
        <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-xs text-muted">{hint}</p>
                </div>
                {aside}
            </div>
            {children}
        </div>
    </section>
);

/** The quantities that each earn one more free item: as chips, typed one at a time, or made in a run. */
const ExtrasEditor = ({ thresholds, max, disabled, onChange }: { thresholds: number[]; max: number; disabled: boolean; onChange: (thresholds: number[]) => void }) => {
    const [ typed, setTyped ] = useState('');
    const [ run, setRun ] = useState({ from: 5, to: Math.min(max, 97), every: 4, each: 1 });
    const counts = useMemo(() => [ ...thresholds.reduce((map, x) => map.set(x, (map.get(x) ?? 0) + 1), new Map<number, number>()) ], [ thresholds ]);
    const unreached = counts.filter(([ quantity ]) => quantity > max).length;
    const typedNumber = Number(typed);
    const canAdd = typed.trim() !== '' && Number.isInteger(typedNumber) && typedNumber >= 1;
    const runQuantities = run.every > 0 && run.to >= run.from ? Array.from({ length: Math.floor((run.to - run.from) / run.every) + 1 }, (_, i) => run.from + i * run.every) : [];

    const add = () => {
        if (!canAdd) return;

        onChange(sorted([ ...thresholds, typedNumber ]));
        setTyped('');
    };

    const removeOne = (quantity: number) => {
        const at = thresholds.indexOf(quantity);

        onChange(thresholds.filter((_, i) => i !== at));
    };

    return (
        <div className="flex flex-col gap-3">
            {counts.length === 0
                ? <p className="rounded-lg border border-dashed border-line px-3 py-2.5 text-xs text-muted">No quantity gives an extra item. Add one below, or make a run of them.</p>
                : (
                        <ul className="flex flex-wrap gap-1.5" aria-label="Quantities that give an extra free item">
                            {counts.map(([ quantity, count ]) => (
                                <li key={quantity}>
                                    <span className={cx('inline-flex h-7 items-center gap-1 rounded-full border pr-1 pl-2.5 font-mono text-xs', quantity > max ? 'border-dashed border-line text-muted' : 'border-line')} title={quantity > max ? `Past the most at once (${max}): never reached` : `Buying ${quantity} or more gives ${count} more free`}>
                                        {quantity}
                                        {count > 1 && <span className="rounded bg-accent-soft px-1 text-[11px] text-accent">+{count}</span>}
                                        {!disabled && (
                                            <button type="button" onClick={() => removeOne(quantity)} aria-label={count > 1 ? `Take one of the ${count} at ${quantity}` : `Take out ${quantity}`} className="grid size-5 place-items-center rounded-full text-muted hover:bg-subtle hover:text-ink">
                                                <X className="size-3" />
                                            </button>
                                        )}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
            {unreached > 0 && <p className="text-xs text-warn">{unreached === 1 ? 'One quantity is' : `${unreached} quantities are`} past the most at once, so no order reaches {unreached === 1 ? 'it' : 'them'}.</p>}
            {!disabled && (
                <div className="grid items-start gap-3 2xl:grid-cols-2">
                    <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
                        <span className="text-xs font-medium text-muted">Add one quantity</span>
                        <div className="flex items-center gap-2">
                            <Input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                placeholder="12"
                                aria-label="Quantity to add"
                                value={typed}
                                onChange={event => setTyped(event.target.value)}
                                onKeyDown={(event: KeyboardEvent) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        add();
                                    }
                                }}
                                className="w-24 font-mono"
                            />
                            <Button variant="secondary" icon={<Plus />} disabled={!canAdd} onClick={add}>Add</Button>
                        </div>
                        <span className="text-xs text-muted">Add the same quantity again for two at once.</span>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
                        <span className="text-xs font-medium text-muted">Add a run</span>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            From <Count label="Run from" value={run.from} min={1} onChange={from => setRun({ ...run, from })} className="w-16" />
                            to <Count label="Run to" value={run.to} min={1} onChange={to => setRun({ ...run, to })} className="w-16" />
                            every <Count label="Run every" value={run.every} min={1} onChange={every => setRun({ ...run, every })} className="w-14" />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                            <Count label="Free at each" value={run.each} min={1} max={10} onChange={each => setRun({ ...run, each })} className="w-14" /> free at each
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="secondary" icon={<Plus />} disabled={runQuantities.length === 0} onClick={() => onChange(sorted([ ...thresholds, ...runQuantities.flatMap(x => Array<number>(run.each).fill(x)) ]))}>
                                Add {runQuantities.length} {runQuantities.length === 1 ? 'quantity' : 'quantities'}
                            </Button>
                            <span className="truncate font-mono text-xs text-muted">{runQuantities.slice(0, 6).join(', ')}{runQuantities.length > 6 ? ', ...' : ''}</span>
                        </div>
                    </div>
                </div>
            )}
            {!disabled && thresholds.length > 0 && <TextButton className="self-start" onClick={() => onChange([])}>Take them all out</TextButton>}
        </div>
    );
};

/** Free items by quantity, one bar each: the bars up to the quantity picked full, the rest faint. Pointed at, it reads; pressed, it picks. */
const FreeChart = ({ ruleset, quantity, onPick }: { ruleset: Ruleset; quantity: number; onPick: (quantity: number) => void }) => {
    const top = Math.min(ruleset.maxPurchaseSize, CHART_LIMIT);
    const values = useMemo(() => Array.from({ length: top }, (_, i) => freeItems(ruleset, i + 1)), [ ruleset, top ]);
    const peak = Math.max(1, ...values);
    const [ hover, setHover ] = useState<number | null>(null);

    const at = (event: PointerEvent<HTMLDivElement>) => {
        const box = event.currentTarget.getBoundingClientRect();

        return Math.min(top, Math.max(1, Math.ceil(((event.clientX - box.left) / box.width) * top)));
    };

    const shown = hover ?? quantity;

    return (
        <figure className="flex flex-col gap-1.5">
            <figcaption className="flex items-baseline justify-between text-xs text-muted">
                <span>Free items by quantity</span>
                <span className="font-mono">peak {peak}</span>
            </figcaption>
            <div
                className="relative h-28 cursor-crosshair touch-none border-b border-line"
                onPointerMove={(event) => {
                    setHover(at(event));

                    if (event.buttons === 1) onPick(at(event));
                }}
                onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    onPick(at(event));
                }}
                onPointerLeave={() => setHover(null)}
                role="img"
                aria-label={`Free items for quantities 1 to ${top}, up to ${peak}`}
            >
                <div className="absolute inset-0 flex items-end gap-px">
                    {values.map((value, i) => (
                        <div
                            key={i}
                            className={cx('min-w-0 flex-1 rounded-t-[2px]', i + 1 <= quantity ? 'bg-accent' : 'bg-accent opacity-25', hover === i + 1 && 'opacity-100 brightness-125')}
                            style={{ height: `${(value / peak) * 100}%` }}
                        />
                    ))}
                </div>
                {hover !== null && (
                    <div
                        className="pointer-events-none absolute -top-2 z-10 rounded-md border border-line bg-surface px-2 py-1 text-xs whitespace-nowrap shadow-sm"
                        style={{ left: `${((hover - 0.5) / top) * 100}%`, transform: `translate(${hover / top > 0.7 ? '-100%' : hover / top < 0.3 ? '0' : '-50%'}, -100%)` }}
                    >
                        Buy <strong className="font-mono">{shown}</strong>, get <strong className="font-mono">{values[shown - 1]}</strong> free
                    </div>
                )}
            </div>
            <div className="flex justify-between font-mono text-[11px] text-muted">
                <span>1</span>
                <span>{top}{ruleset.maxPurchaseSize > CHART_LIMIT ? ` of ${ruleset.maxPurchaseSize}` : ''}</span>
            </div>
        </figure>
    );
};

/** The ruleset as a buyer meets it: a quantity picked, what they pay for and get, and where the free items come from. */
const Preview = ({ ruleset }: { ruleset: Ruleset }) => {
    const [ picked, setPicked ] = useState(10);
    const quantity = Math.max(1, Math.min(picked, ruleset.maxPurchaseSize));
    const parts = breakdown(ruleset, quantity);
    const next = nextFree(ruleset, quantity);

    return (
        <Panel title="Try it" description="What a buyer sees and gets, from the values here, saved or not.">
            <div className="flex flex-col gap-4 p-4">
                <div className="flex items-center gap-3">
                    <input
                        type="range"
                        min={1}
                        max={ruleset.maxPurchaseSize}
                        value={quantity}
                        onChange={event => setPicked(Number(event.target.value))}
                        aria-label="Quantity bought"
                        className="min-w-0 flex-1 accent-accent"
                    />
                    <Count label="Quantity bought" value={quantity} min={1} max={ruleset.maxPurchaseSize} onChange={setPicked} />
                </div>
                <div className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line text-center">
                    <div className="p-2.5">
                        <div className="font-mono text-xl font-semibold tabular-nums">{quantity}</div>
                        <div className="text-xs text-muted">paid for</div>
                    </div>
                    <div className="p-2.5">
                        <div className={cx('font-mono text-xl font-semibold tabular-nums', parts.total > 0 && 'text-accent')}>+{parts.total}</div>
                        <div className="text-xs text-muted">free</div>
                    </div>
                    <div className="p-2.5">
                        <div className="font-mono text-xl font-semibold tabular-nums">{quantity + parts.total}</div>
                        <div className="text-xs text-muted">received</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-canvas p-2.5 text-xs" aria-label="The client's spinner">
                    <span className="grid h-7 min-w-12 place-items-center rounded border border-line bg-surface px-2 font-mono">{quantity}</span>
                    {parts.total > 0
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-good-soft px-2 py-1 text-good"><Star className="size-3 fill-current" /> {parts.total} bonus {parts.total === 1 ? 'item' : 'items'}</span>
                        : <span className="text-muted">No bonus line</span>}
                    <span className="ml-auto text-muted">in the client</span>
                </div>
                <ul className="flex flex-col gap-1 text-xs">
                    <li className="flex justify-between gap-2"><span className="text-muted">From bundles</span><span className="font-mono">{parts.bundles}</span></li>
                    <li className="flex justify-between gap-2"><span className="text-muted">From the growing bonus</span><span className="font-mono">{parts.bonus}</span></li>
                    <li className="flex justify-between gap-2">
                        <span className="text-muted">From extra quantities{parts.extras.length > 0 && <span className="font-mono"> ({[ ...new Set(parts.extras) ].join(', ')})</span>}</span>
                        <span className="font-mono">{parts.extras.length}</span>
                    </li>
                </ul>
                <p className="text-xs text-muted">
                    {next
                        ? <>The next free item comes at <TextButton onClick={() => setPicked(next.quantity)}>{next.quantity}</TextButton> ({next.free} free).</>
                        : `No more free items up to ${ruleset.maxPurchaseSize}.`}
                </p>
                <FreeChart ruleset={ruleset} quantity={quantity} onPick={setPicked} />
            </div>
        </Panel>
    );
};

/** The ruleset's setup, started from what is configured now. */
const DiscountForm = ({ settings, canManage }: { settings: Record<Name, ServerSetting>; canManage: boolean }) => {
    const start = useMemo(() => rulesetOf(settings), [ settings ]);
    const [ draft, setDraft ] = useState(start);
    const save = useSaveSetting();
    const reset = useResetSetting();
    const lockedBy = (name: Name) => settings[name].startup || settings[name].source === SOURCE.environment;
    const editable = (name: Name) => canManage && !lockedBy(name);
    const changed = NAMES.filter(name => editable(name) && jsonOf(name, draft) !== settings[name].value);
    const setHere = NAMES.filter(name => settings[name].source === SOURCE.panel);
    const live = NAMES.every(name => settings[name].live);
    const busy = save.isPending || reset.isPending;
    const preset = PRESETS.find(x => sameRuleset(x.ruleset, draft))?.key ?? 'custom';
    const bundlesOn = draft.bundleSize > 0;
    const bonusOn = bundlesOn && draft.bonusThreshold < NO_BONUS;
    const set = (change: Partial<Ruleset>) => setDraft({ ...draft, ...change });

    const submit = async () => {
        for (const name of changed) await save.mutateAsync({ path: pathOf(name), value: jsonOf(name, draft) });

        toast(live ? 'Saved the bundle discounts.' : 'Saved the bundle discounts: they apply after a restart.');
    };

    const putBack = () => ask(
        { title: 'Put the bundle discounts back to what appsettings.json says?', body: live ? 'It applies at once.' : 'It applies after a restart.', confirm: 'Put back' },
        async () => {
            for (const name of setHere) await reset.mutateAsync(pathOf(name));
        },
    );

    return (
        <div className="grid items-start gap-4 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
                {NAMES.some(lockedBy) && <WarningNotice>Some of these are set in the environment, which always wins over the panel. Change them there.</WarningNotice>}
                <Panel
                    title="Start from"
                    description={<>A ready-made setup to adjust below. Free items are given on top of what is paid for; the builders club has none. Also under <Link to={`/settings?q=${encodeURIComponent(SECTION)}`} className="underline-offset-2 hover:underline">Settings</Link>.</>}
                >
                    <div className="grid gap-2 p-4 sm:grid-cols-3">
                        {PRESETS.map(option => (
                            <button
                                key={option.key}
                                type="button"
                                disabled={!canManage}
                                aria-pressed={preset === option.key}
                                onClick={() => set(option.ruleset)}
                                className={cx(
                                    'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors disabled:pointer-events-none [&>svg]:size-4',
                                    preset === option.key ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent',
                                )}
                            >
                                <span className={cx('flex items-center gap-1.5 text-sm font-medium [&>svg]:size-4', preset === option.key && 'text-accent')}>{option.icon}{option.label}</span>
                                <span className="text-xs text-muted">{option.hint}</span>
                            </button>
                        ))}
                    </div>
                    {preset === 'custom' && <p className="px-4 pb-4 text-xs text-muted">Custom: none of these, as set below.</p>}
                </Panel>
                <Panel title="Set it up" className="overflow-clip">
                    <div className="divide-y divide-line">
                        <Step number={1} title="Most at once" hint="How high the client's quantity spinner goes. A bigger order is refused. Only offers that can be bundled go past one.">
                            <div className="flex items-center gap-3">
                                <input type="range" min={1} max={Math.max(200, draft.maxPurchaseSize)} value={draft.maxPurchaseSize} onChange={event => set({ maxPurchaseSize: Number(event.target.value) })} disabled={!editable('MaxPurchaseSize')} aria-label="Most at once" className="min-w-0 flex-1 accent-accent" />
                                <Count label="Most at once" value={draft.maxPurchaseSize} min={1} onChange={maxPurchaseSize => set({ maxPurchaseSize })} disabled={!editable('MaxPurchaseSize')} />
                            </div>
                        </Step>
                        <Step
                            number={2}
                            title="Bundle deal"
                            hint="Free items for every whole bundle bought, like buy 5, get 1 free."
                            aside={<Switch label={<span className="sr-only">Bundle deal</span>} checked={bundlesOn} disabled={!editable('BundleSize')} onChange={on => set(on ? { bundleSize: 5, bundleDiscountSize: Math.max(1, draft.bundleDiscountSize), bonusThreshold: NO_BONUS } : { bundleSize: 0 })} className="min-h-0" />}
                        >
                            {bundlesOn && (
                                <>
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <Gift className="size-4 text-accent" />
                                        Every
                                        <Count label="Bundle size" value={draft.bundleSize} min={1} onChange={bundleSize => set({ bundleSize })} disabled={!editable('BundleSize')} className="w-16" />
                                        bought gives
                                        <Count label="Free per bundle" value={draft.bundleDiscountSize} min={0} onChange={bundleDiscountSize => set({ bundleDiscountSize })} disabled={!editable('BundleDiscountSize')} className="w-16" />
                                        free.
                                    </div>
                                    <div className="rounded-lg border border-line p-3">
                                        <Switch
                                            label="Growing bonus"
                                            hint="Past a number of whole bundles, each bundle gives one more on top, and a bundle one item short gets one early."
                                            checked={bonusOn}
                                            disabled={!editable('BonusThreshold')}
                                            onChange={on => set({ bonusThreshold: on ? 2 : NO_BONUS })}
                                        />
                                        {bonusOn && (
                                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                                                From
                                                <Count label="Growing bonus from" value={draft.bonusThreshold} min={-1} max={NO_BONUS - 1} onChange={bonusThreshold => set({ bonusThreshold })} disabled={!editable('BonusThreshold')} className="w-16" />
                                                whole bundles ({Math.max(0, draft.bonusThreshold) * draft.bundleSize} items) up.
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </Step>
                        <Step number={3} title="Extra free items at" hint="Each quantity listed gives one more free item to any order that reaches it. Habbo uses these alone.">
                            <ExtrasEditor thresholds={draft.thresholds} max={draft.maxPurchaseSize} disabled={!editable('AdditionalBonusDiscountThresholdQuantities')} onChange={thresholds => set({ thresholds })} />
                        </Step>
                    </div>
                </Panel>
                {canManage && (
                    <Panel className="sticky bottom-3 z-10 shadow-lg">
                        <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1 text-xs">
                                {changed.length === 0
                                    ? <span className="text-muted">No changes. {live ? 'Changes apply at once.' : 'Changes apply after a restart.'}</span>
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
            <div className="xl:sticky xl:top-4">
                <Preview ruleset={draft} />
            </div>
        </div>
    );
};

/**
 * The catalog's bulk-buy ruleset (`Turbo:Catalog:BundleDiscount`): the most of an offer bought at
 * once and the free items a purchase gives on top, set up in steps beside a preview of what a
 * buyer gets, and saved through the server's settings.
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
            <PageHeader title="Catalog" tabs={catalogTabs('discounts')} description="Bulk buying and the free items it gives" />
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
