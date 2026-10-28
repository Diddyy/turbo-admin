import { Plus, Receipt, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import { useFurnitureSearch } from '#/api/catalog';
import { BONUS_SOURCES, type BonusRareCampaign, PURCHASE_RESULTS, useBonusRareCampaigns, useBonusRareStanding, useDeleteBonusRareCampaign, useRecordBonusRarePurchase, useSaveBonusRareCampaign } from '#/api/hotelView';
import type { ImageAccept } from '#/api/media';
import { ask } from '#/components/confirm';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, Panel, Select, SuccessNotice } from '#/components/ui';
import { cx } from '#/lib/cx';

import type { HotelViewDraft } from './draft';
import { useResolveImage } from './hooks';
import { COMMON, inputToIso, isoTime, isoToInput, LIBRARY_ADDRESS } from './model';
import { ImageField } from './parts';
import { Placement } from './Placement';

const BONUS_RARE_IMAGE: ImageAccept = { ...LIBRARY_ADDRESS, usedIn: 'hotelView.bonusRare' };

type CampaignDraft = Omit<BonusRareCampaign, 'id'>;

/** Whether it runs at the time: started, and not ended. */
const isRunning = (campaign: BonusRareCampaign, now: number) => (isoTime(campaign.startsAt) ?? 0) <= now && (isoTime(campaign.endsAt) ?? Infinity) > now;

/** A furniture to give, found by name, with its icon. */
const FurniturePicker = ({ value, onChange, disabled }: { value: string; onChange: (name: string) => void; disabled?: boolean }) => {
    const assets = useClientAssets();
    const [ text, setText ] = useState('');
    const { data: found } = useFurnitureSearch(text);
    const icon = furniIconUrl(assets, value || null);

    return (
        <Labeled label="Furniture given" hint="Found by its name in the furniture definitions.">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-canvas">{icon && <img src={icon} alt="" className="max-h-8 max-w-8" />}</span>
                    <Input value={value} onChange={event => onChange(event.target.value.trim())} className="font-mono" disabled={disabled} />
                </div>
                {!disabled && <Input type="search" value={text} onChange={event => setText(event.target.value)} placeholder="Find furniture" aria-label="Find furniture" />}
                {found && found.length > 0 && text.trim() && (
                    <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                        {found.slice(0, 20).map(furni => (
                            <li key={furni.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(furni.name);
                                        setText('');
                                    }}
                                    className="flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm hover:bg-subtle"
                                >
                                    <img src={furniIconUrl(assets, furni.name) ?? ''} alt="" className="max-h-6 max-w-6" />
                                    <span className="font-mono text-xs">{furni.name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Labeled>
    );
};

const empty = (now: number): CampaignDraft => ({
    code: '',
    furnitureName: '',
    productCode: '',
    creditsRequired: 120,
    source: 0,
    startsAt: new Date(now).toISOString(),
    endsAt: null,
});

/** How a campaign has gone. */
const Standing = ({ code }: { code: string }) => {
    const { data } = useBonusRareStanding(code);

    if (!data) return null;

    return (
        <div className="flex flex-wrap gap-2">
            <Badge tone="accent">{data.rewardsGiven} given</Badge>
            <Badge>{data.playersInProgress} players on their way</Badge>
        </div>
    );
};

/** One campaign: what it gives, for how many credits, counted how, and when. */
const CampaignEditor = ({ campaign, now, onDone, disabled }: { campaign: BonusRareCampaign | null; now: number; onDone: () => void; disabled?: boolean }) => {
    const [ draft, setDraft ] = useState<CampaignDraft>(() => (campaign ? { ...campaign } : empty(now)));
    const save = useSaveBonusRareCampaign();
    const remove = useDeleteBonusRareCampaign();
    const set = (change: Partial<CampaignDraft>) => setDraft(previous => ({ ...previous, ...change }));

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ ...draft, id: campaign?.id ?? null }, { onSuccess: () => !campaign && onDone() });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="Code" hint="Progress is kept under it: a new code starts everyone afresh.">
                    <Input value={draft.code} onChange={event => set({ code: event.target.value.trim() })} className="font-mono" disabled={disabled} autoFocus={!campaign} />
                </Labeled>
                <Labeled label="Credits for each reward">
                    <Input value={draft.creditsRequired} onChange={event => set({ creditsRequired: Number(event.target.value.replace(/\D/g, '')) || 0 })} inputMode="numeric" disabled={disabled} />
                </Labeled>
                <FurniturePicker value={draft.furnitureName} onChange={furnitureName => set({ furnitureName })} disabled={disabled} />
                <Labeled label="Product code" hint="The product data entry the widget names the reward by. Empty: the furniture's name.">
                    <Input value={draft.productCode} onChange={event => set({ productCode: event.target.value.trim() })} className="font-mono" disabled={disabled} />
                </Labeled>
                <Labeled label="What counts" hint={draft.source === 0 ? 'Only credits bought, recorded with their receipt below or by the hotel\'s shop.' : 'Every credit spent on the normal catalogue.'}>
                    <Select value={String(draft.source)} onChange={event => set({ source: Number(event.target.value) })} disabled={disabled}>
                        {Object.entries(BONUS_SOURCES).map(([ value, label ]) => <option key={value} value={value}>{label}</option>)}
                    </Select>
                </Labeled>
                <div className="grid grid-cols-2 gap-3">
                    <Labeled label="Starts (UTC)">
                        <Input type="datetime-local" value={isoToInput(draft.startsAt)} onChange={event => set({ startsAt: inputToIso(event.target.value) ?? draft.startsAt })} disabled={disabled} />
                    </Labeled>
                    <Labeled label="Ends (UTC)" hint="Empty: until another starts.">
                        <Input type="datetime-local" value={isoToInput(draft.endsAt)} onChange={event => set({ endsAt: inputToIso(event.target.value) })} disabled={disabled} />
                    </Labeled>
                </div>
            </div>
            {!disabled && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" icon={campaign ? <Save /> : <Plus />} disabled={save.isPending || !draft.code || !draft.furnitureName}>{campaign ? 'Save' : 'Add'}</Button>
                    <Button variant="ghost" icon={<X />} onClick={onDone}>{campaign ? 'Close' : 'Cancel'}</Button>
                    {campaign && (
                        <Button
                            variant="ghost"
                            icon={<Trash2 />}
                            className="ml-auto text-bad hover:text-bad"
                            disabled={remove.isPending}
                            onClick={() => ask({ title: `Remove the campaign ${campaign.code}?`, body: 'Players\' progress stays under its code.', confirm: 'Remove' }, () => remove.mutate(campaign.id, { onSuccess: onDone }))}
                        >
                            Remove
                        </Button>
                    )}
                </div>
            )}
            {save.isSuccess && campaign && <SuccessNotice>Saved.</SuccessNotice>}
            {(save.error || remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
            {campaign && <Standing code={campaign.code} />}
        </form>
    );
};

/** Credits a player bought outside the client, recorded once by their receipt. */
const RecordPurchase = () => {
    const [ player, setPlayer ] = useState('');
    const [ credits, setCredits ] = useState('');
    const [ reference, setReference ] = useState('');
    const record = useRecordBonusRarePurchase();

    return (
        <Panel title="Record bought credits" description="For a campaign that counts bought credits: a purchase made outside the client, by its order number. The same order counts once.">
            <form
                className="flex flex-wrap items-end gap-3 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    record.mutate({ playerId: Number(player), credits: Number(credits), reference: reference.trim() });
                }}
            >
                <Labeled label="Player id"><Input value={player} onChange={event => setPlayer(event.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-32" /></Labeled>
                <Labeled label="Credits"><Input value={credits} onChange={event => setCredits(event.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-32" /></Labeled>
                <Labeled label="Receipt" className="min-w-48 flex-1"><Input value={reference} onChange={event => setReference(event.target.value)} placeholder="order-1234" className="font-mono" /></Labeled>
                <Button type="submit" variant="secondary" icon={<Receipt />} disabled={!player || !credits || !reference.trim() || record.isPending}>Record</Button>
            </form>
            {record.data && <div className={cx('px-4 pb-4 text-sm', record.data.result === 0 ? 'text-good' : 'text-warn')}>{PURCHASE_RESULTS[record.data.result]}</div>}
            {record.error && <div className="px-4 pb-4"><ErrorNotice error={record.error} /></div>}
        </Panel>
    );
};

/**
 * The bonus rare: a furniture given for every so many credits a player brings in, counted as the
 * running campaign says. The campaigns are saved at once; the widget's picture is a variable, kept
 * with the page's other changes until they are saved together. Above them, which slot shows it.
 */
export const BonusRareTab = ({ draft, now, onOpenSlot, disabled }: { draft: HotelViewDraft; now: number; onOpenSlot: (slot: number) => void; disabled?: boolean }) => {
    const resolve = useResolveImage(draft);
    const { data, error } = useBonusRareCampaigns();
    const [ open, setOpen ] = useState<number | 'new' | null>(null);
    const campaigns = data?.campaigns ?? [];
    const running = campaigns.filter(x => isRunning(x, now)).sort((a, b) => (isoTime(b.startsAt) ?? 0) - (isoTime(a.startsAt) ?? 0))[0];

    return (
        <div className="flex flex-col gap-4">
            <Placement draft={draft} widget="bonusrare" what="the bonus rare" onOpenSlot={onOpenSlot} disabled={disabled} />
            <Panel
                title="Bonus rare campaigns"
                description="The last one started and not ended runs; with none, the widget is hidden. Each is saved at once."
                actions={!disabled && <Button variant="secondary" icon={<Plus />} onClick={() => setOpen('new')} disabled={open === 'new'}>New campaign</Button>}
                className="overflow-clip"
            >
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!data && !error && <Loading />}
                {open === 'new' && <div className="border-b border-line bg-subtle/40 p-4"><CampaignEditor campaign={null} now={now} onDone={() => setOpen(null)} disabled={disabled} /></div>}
                {data && campaigns.length === 0 && open !== 'new' && <EmptyState>No campaigns: the widget is hidden.</EmptyState>}
                <ul className="divide-y divide-line">
                    {campaigns.map(campaign => (
                        <li key={campaign.id}>
                            <button type="button" onClick={() => setOpen(open === campaign.id ? null : campaign.id)} className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-subtle', open === campaign.id && 'bg-subtle/60')}>
                                <span className="truncate font-mono text-sm">{campaign.code}</span>
                                <span className="truncate text-xs text-muted">{campaign.furnitureName} for {campaign.creditsRequired} credits</span>
                                <Badge>{BONUS_SOURCES[campaign.source] ?? campaign.source}</Badge>
                                {campaign.id === running?.id && <Badge tone="green">Running</Badge>}
                            </button>
                            {open === campaign.id && <div className="border-t border-line bg-subtle/40 p-4"><CampaignEditor key={campaign.id} campaign={campaign} now={now} onDone={() => setOpen(null)} disabled={disabled} /></div>}
                        </li>
                    ))}
                </ul>
            </Panel>
            <Panel title="Widget picture" description="What the bonus rare widget shows beside the furni and the count. Kept with the page's other changes until you press Save.">
                <div className="p-4">
                    <ImageField label="Picture" value={draft.text(COMMON.bonusRareImage)} onChange={value => draft.setText(COMMON.bonusRareImage, value)} accept={BONUS_RARE_IMAGE} resolve={resolve} changed={draft.changed(COMMON.bonusRareImage)} disabled={disabled} />
                </div>
            </Panel>
            {!disabled && <RecordPurchase />}
        </div>
    );
};
