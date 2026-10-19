import { CheckCheck, Copy, Plus, Trash2, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';

import { badgeUrl, useClientAssets } from '#/api/assets';
import { ACHIEVEMENT_STATES, type AchievementDefinition, type AchievementItem, useAchievementDefinition, useAchievements, useCheckAchievement, usePublishAchievement } from '#/api/content';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Labeled, Loading, Panel, Select, SuccessNotice, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useFillHeight } from '#/lib/fillHeight';

const STATE_TONES: Record<number, 'green' | 'neutral' | 'amber' | 'red'> = { 0: 'red', 1: 'green', 2: 'neutral', 3: 'amber', 4: 'neutral' };

/** A time the catalog keeps (UTC) for a `datetime-local` input, and back. */
const toInput = (iso: string | null) => (iso ? iso.replace(/Z$/, '').slice(0, 16) : '');
const fromInput = (value: string) => (value ? `${value}:00Z` : null);

/** A badge's picture, as the client loads it. */
const BadgeImage = ({ code, className }: { code: string | null; className?: string }) => {
    const assets = useClientAssets();
    const url = badgeUrl(assets, code);

    return (
        <span className={cx('grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-canvas', className)}>
            {url && <img src={url} alt="" className="max-h-full max-w-full [image-rendering:pixelated]" />}
        </span>
    );
};

/**
 * One achievement's definition to edit: its place, state and dates, and each level's requirement,
 * badge, score and reward; or the whole of it as JSON. Checked as the catalog checks it, then
 * published as its next revision with a reason.
 */
const AchievementEditor = ({ item, all, canManage, onPublished }: { item: AchievementItem; all: AchievementItem[]; canManage: boolean; onPublished: (id: number) => void }) => {
    const { data, error } = useAchievementDefinition(item.id);

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    return <DefinitionForm key={data.definitionJson} initial={JSON.parse(data.definitionJson) as AchievementDefinition} all={all} canManage={canManage} onPublished={onPublished} />;
};

const DefinitionForm = ({ initial, all, canManage, onPublished }: { initial: AchievementDefinition; all: AchievementItem[]; canManage: boolean; onPublished: (id: number) => void }) => {
    const [ definition, setDefinition ] = useState(initial);
    const [ raw, setRaw ] = useState<string | null>(null);
    const check = useCheckAchievement();
    const publish = usePublishAchievement();
    const set = (change: Partial<AchievementDefinition>) => {
        setDefinition(previous => ({ ...previous, ...change }));
        check.reset();
    };
    const setLevel = (index: number, change: Partial<AchievementDefinition['Levels'][number]>) => set({ Levels: definition.Levels.map((x, i) => (i === index ? { ...x, ...change } : x)) });
    const json = raw ?? JSON.stringify(definition, null, 2);
    const isNew = !all.some(x => x.id === definition.Id);
    const disabled = !canManage;

    let rawProblem: string | null = null;

    if (raw !== null) {
        try {
            JSON.parse(raw);
        } catch {
            rawProblem = 'Not JSON.';
        }
    }

    return (
        <div className="flex flex-col gap-4">
            {isNew && <SuccessNotice>A new achievement, id {definition.Id}: give it a key of its own and publish it.</SuccessNotice>}
            {raw === null && (
                <>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <Labeled label="Key"><Input value={definition.Key} onChange={event => set({ Key: event.target.value.trim() })} className="font-mono" disabled={disabled || !isNew} /></Labeled>
                        <Labeled label="Category"><Input value={definition.Category} onChange={event => set({ Category: event.target.value.trim() })} disabled={disabled} /></Labeled>
                        <Labeled label="Subcategory"><Input value={definition.SubCategory} onChange={event => set({ SubCategory: event.target.value.trim() })} disabled={disabled} /></Labeled>
                        <Labeled label="State" hint="Retired: players keep what they earned, nothing more is given.">
                            <Select value={String(definition.State)} onChange={event => set({ State: Number(event.target.value) })} disabled={disabled}>
                                {Object.entries(ACHIEVEMENT_STATES).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                            </Select>
                        </Labeled>
                        <Labeled label="Active from (UTC)" hint="Empty: always.">
                            <Input type="datetime-local" value={toInput(definition.ActiveFromUtc)} onChange={event => set({ ActiveFromUtc: fromInput(event.target.value) })} disabled={disabled} />
                        </Labeled>
                        <Labeled label="Active until (UTC)" hint="Empty: for good.">
                            <Input type="datetime-local" value={toInput(definition.ActiveUntilUtc)} onChange={event => set({ ActiveUntilUtc: fromInput(event.target.value) })} disabled={disabled} />
                        </Labeled>
                        <Labeled label="Order"><Input value={definition.Order} onChange={event => set({ Order: Number(event.target.value.replace(/[^-\d]/g, '')) || 0 })} inputMode="numeric" disabled={disabled} /></Labeled>
                        <Labeled label="Counts" hint="What progress comes from: the source the server reports."><Input value={`${definition.Source} v${definition.SourceVersion}`} disabled /></Labeled>
                    </div>
                    <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-semibold">Levels</h3>
                        <ol className="divide-y divide-line rounded-lg border border-line">
                            {definition.Levels.map((level, index) => (
                                <li key={index} className="flex flex-wrap items-end gap-3 p-3">
                                    <span className="w-6 pb-2 text-right font-mono text-xs text-muted">{index + 1}</span>
                                    <BadgeImage code={level.BadgeCode} />
                                    <Labeled label="Badge" className="w-full sm:w-44"><Input value={level.BadgeCode} onChange={event => setLevel(index, { BadgeCode: event.target.value.trim() })} className="font-mono text-xs" disabled={disabled} /></Labeled>
                                    <Labeled label="Requirement" className="w-[calc(50%-0.375rem)] sm:w-28"><Input value={level.Requirement} onChange={event => setLevel(index, { Requirement: Number(event.target.value.replace(/\D/g, '')) || 0 })} inputMode="numeric" disabled={disabled} /></Labeled>
                                    <Labeled label="Score" className="w-[calc(50%-0.375rem)] sm:w-24"><Input value={level.Score} onChange={event => setLevel(index, { Score: Number(event.target.value.replace(/\D/g, '')) || 0 })} inputMode="numeric" disabled={disabled} /></Labeled>
                                    {level.Rewards.map((reward, r) => (
                                        <Labeled key={r} label={`Reward ${reward.Handler}`} className="w-[calc(50%-0.375rem)] sm:w-28">
                                            <Input
                                                value={reward.Amount}
                                                onChange={event => setLevel(index, { Rewards: level.Rewards.map((x, j) => (j === r ? { ...x, Amount: Number(event.target.value.replace(/\D/g, '')) || 0 } : x)) })}
                                                inputMode="numeric"
                                                disabled={disabled}
                                            />
                                        </Labeled>
                                    ))}
                                    {!disabled && index === definition.Levels.length - 1 && definition.Levels.length > 1 && (
                                        <IconButton label="Remove the last level" icon={<Trash2 />} tone="bad" onClick={() => set({ Levels: definition.Levels.slice(0, -1) })} />
                                    )}
                                </li>
                            ))}
                        </ol>
                        {!disabled && definition.Levels.length > 0 && (
                            <div>
                                <Button
                                    variant="secondary"
                                    icon={<Plus />}
                                    onClick={() => {
                                        const last = definition.Levels[definition.Levels.length - 1]!;
                                        const badge = last.BadgeCode.replace(/\d+$/, String(definition.Levels.length + 1));

                                        set({ Levels: [ ...definition.Levels, { ...last, Requirement: last.Requirement * 2, BadgeCode: badge } ] });
                                    }}
                                >
                                    Add a level
                                </Button>
                            </div>
                        )}
                    </div>
                </>
            )}
            {raw !== null && (
                <Labeled label="The definition, as the catalog keeps it" hint={rawProblem ?? 'Every field, the match and the rewards\' payloads included.'}>
                    <Textarea value={json} onChange={event => setRaw(event.target.value)} rows={24} className="font-mono text-xs" disabled={disabled} />
                </Labeled>
            )}
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    variant="ghost"
                    onClick={() => {
                        if (raw === null) {
                            setRaw(JSON.stringify(definition, null, 2));
                        } else if (!rawProblem) {
                            setDefinition(JSON.parse(raw) as AchievementDefinition);
                            setRaw(null);
                        }
                    }}
                    disabled={raw !== null && !!rawProblem}
                >
                    {raw === null ? 'Edit as JSON' : 'Back to the form'}
                </Button>
                {canManage && (
                    <>
                        <Button variant="secondary" icon={<CheckCheck />} disabled={!!rawProblem || check.isPending} onClick={() => check.mutate(json)}>Check</Button>
                        <Button
                            icon={<Upload />}
                            disabled={!!rawProblem || publish.isPending}
                            onClick={() => {
                                const reason = window.prompt('Why? The publish is on record with its reason.');

                                if (!reason?.trim()) return;

                                const id = (JSON.parse(json) as AchievementDefinition).Id;

                                publish.mutate({ id, definitionJson: json, reason: reason.trim() }, { onSuccess: () => onPublished(id) });
                            }}
                        >
                            Publish
                        </Button>
                        {!isNew && (
                            <Button
                                variant="ghost"
                                icon={<Copy />}
                                className="ml-auto"
                                onClick={() => {
                                    const id = Math.max(0, ...all.map(x => x.id)) + 1;

                                    setRaw(null);
                                    set({ Id: id, Key: `${definition.Key}_copy`, Revision: 0 });
                                }}
                            >
                                Copy as a new achievement
                            </Button>
                        )}
                    </>
                )}
            </div>
            {check.isSuccess && <SuccessNotice>It checks out: publishing makes it revision {check.data.revision}.</SuccessNotice>}
            {publish.isSuccess && <SuccessNotice>Published as revision {publish.data.revision}. Players have it now.</SuccessNotice>}
            {(check.error || publish.error) && <ErrorNotice error={check.error ?? publish.error} />}
        </div>
    );
};

/**
 * The hotel's achievements, from the achievement catalog: by category, with their state and badges.
 * An edit is checked as the catalog checks it, then published as the next revision, live at once
 * and on record with why.
 */
export const AchievementsTab = () => {
    const { data, error } = useAchievements();
    const [ filter, setFilter ] = useState('');
    const [ open, setOpen ] = useState<number | null>(null);
    const items = useMemo(() => data?.achievements ?? [], [ data ]);
    const words = filter.trim().toLowerCase();
    const shown = items.filter(x => !words || x.key.toLowerCase().includes(words) || x.category.toLowerCase().includes(words) || x.source.toLowerCase().includes(words));
    const selected = items.find(x => x.id === open) ?? null;
    const categories = [ ...new Set(shown.map(x => x.category)) ];
    const fillList = useFillHeight<HTMLElement>();

    if (error) return <ErrorNotice error={error} />;
    if (!data) return <Loading />;

    return (
        <div className="grid items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
            <Panel ref={fillList} className="flex flex-col overflow-clip lg:sticky lg:top-4 lg:max-h-(--fill-height)">
                <div className="border-b border-line p-3">
                    <SearchInput value={filter} onValueChange={setFilter} placeholder="Key, category or source" aria-label="Find achievements" />
                </div>
                {shown.length === 0 && <EmptyState>No achievement matches.</EmptyState>}
                <div className="max-h-[60dvh] min-h-0 overflow-y-auto lg:max-h-none">
                    {categories.map(category => (
                        <section key={category}>
                            <h3 className="sticky top-0 border-b border-line bg-subtle px-3 py-1.5 font-mono text-[11px] tracking-wide text-muted uppercase">{category}</h3>
                            <ul className="divide-y divide-line">
                                {shown.filter(x => x.category === category).map(item => (
                                    <li key={item.id}>
                                        <button type="button" onClick={() => setOpen(item.id)} className={cx('flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-subtle', open === item.id && 'bg-accent-soft/50')}>
                                            <BadgeImage code={item.lastBadge} className="size-9" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-mono text-[13px]">{item.key}</span>
                                                <span className="block text-xs text-muted">{item.levels} levels · rev {item.revision}</span>
                                            </span>
                                            {item.state !== 1 && <Badge tone={STATE_TONES[item.state] ?? 'neutral'}>{ACHIEVEMENT_STATES[item.state] ?? item.state}</Badge>}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </div>
            </Panel>
            {!selected && <Panel><EmptyState>Choose an achievement.</EmptyState></Panel>}
            {selected && (
                <Panel key={selected.id} title={<span className="font-mono">{selected.key}</span>} description={`Id ${selected.id}, revision ${selected.revision}, counted from ${selected.source}.`}>
                    <div className="p-4">
                        <AchievementEditor item={selected} all={items} canManage={data.canManage} onPublished={setOpen} />
                    </div>
                </Panel>
            )}
        </div>
    );
};
