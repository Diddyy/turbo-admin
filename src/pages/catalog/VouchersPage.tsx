import { Copy, Download, Plus, Save, Sparkles, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { furniIconUrl, useClientAssets } from '#/api/assets';
import { useCatalogTree, useFurnitureSearch } from '#/api/catalog';
import { useDeleteVoucher, useGenerateVouchers, useSaveVoucher, useVoucherRedemptions, useVouchers, type VoucherDraft, type VoucherItem } from '#/api/vouchers';
import { ask } from '#/components/confirm';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, PageBody, PageHeader, Panel, Select, SuccessNotice, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';
import { useDebounced } from '#/lib/debounce';
import { inputToIso, isoTime, isoToInput } from '#/pages/hotel-view/model';

import { catalogTabs } from './catalogTabs';

const EMPTY: VoucherDraft = {
    code: '',
    credits: 0,
    currencyTypeId: null,
    currencyAmount: 0,
    furnitureDefinitionId: null,
    furnitureQuantity: 0,
    badgeCode: null,
    maxUses: 1,
    expiresAt: null,
    enabled: true,
    note: '',
};

const digits = (text: string) => Number(text.replace(/\D/g, '')) || 0;

/** "2026-10-09 12:00" in UTC. */
const utc = (iso: string) => new Date(isoTime(iso) ?? 0).toISOString().slice(0, 16).replace('T', ' ');

/** What a voucher gives, in a few words. */
const rewards = (item: VoucherItem, currencyName: (id: number) => string) => {
    const voucher = item.voucher;
    const parts: string[] = [];

    if (voucher.credits > 0) parts.push(`${voucher.credits} credits`);
    if (voucher.currencyTypeId !== null && voucher.currencyAmount > 0) parts.push(`${voucher.currencyAmount} ${currencyName(voucher.currencyTypeId)}`);
    if (voucher.furnitureDefinitionId !== null && voucher.furnitureQuantity > 0) parts.push(`${voucher.furnitureQuantity}× ${item.furnitureName ?? `furniture #${voucher.furnitureDefinitionId}`}`);
    if (voucher.badgeCode) parts.push(`badge ${voucher.badgeCode}`);

    return parts.join(' · ') || 'nothing';
};

/** The furniture a voucher gives, found by name, kept by its definition. */
const FurniturePicker = ({ id, name, onChange, disabled }: { id: number | null; name: string | null; onChange: (id: number | null, name: string | null) => void; disabled?: boolean }) => {
    const assets = useClientAssets();
    const [ text, setText ] = useState('');
    const { data: found } = useFurnitureSearch(useDebounced(text));
    const icon = furniIconUrl(assets, name);

    return (
        <Labeled label="Furniture" hint="Found by its name in the furniture definitions.">
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-canvas">{icon && <img src={icon} alt="" className="max-h-8 max-w-8" />}</span>
                    <span className={cx('min-w-0 flex-1 truncate font-mono text-sm', id === null && 'text-muted')}>{id === null ? 'none' : name ?? `#${id}`}</span>
                    {id !== null && !disabled && <Button variant="ghost" icon={<X />} onClick={() => onChange(null, null)}>Clear</Button>}
                </div>
                {!disabled && <Input type="search" value={text} onChange={event => setText(event.target.value)} placeholder="Find furniture" aria-label="Find furniture" />}
                {found && found.length > 0 && text.trim() && (
                    <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line">
                        {found.slice(0, 20).map(furni => (
                            <li key={furni.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(furni.id, furni.name);
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

/** What a voucher gives and when it can be redeemed: the fields one voucher and a batch share. */
const RewardFields = ({ draft, furnitureName, set, disabled }: { draft: VoucherDraft; furnitureName: string | null; set: (change: Partial<VoucherDraft>, furnitureName?: string | null) => void; disabled?: boolean }) => {
    const currencies = useCatalogTree().data?.currencies ?? [];

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <Labeled label="Credits">
                <Input value={draft.credits} onChange={event => set({ credits: digits(event.target.value) })} inputMode="numeric" disabled={disabled} />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
                <Labeled label="Currency">
                    <Select value={draft.currencyTypeId ?? ''} onChange={event => set({ currencyTypeId: event.target.value ? Number(event.target.value) : null })} disabled={disabled}>
                        <option value="">None</option>
                        {currencies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </Select>
                </Labeled>
                <Labeled label="Amount">
                    <Input value={draft.currencyAmount} onChange={event => set({ currencyAmount: digits(event.target.value) })} inputMode="numeric" disabled={disabled || draft.currencyTypeId === null} />
                </Labeled>
            </div>
            <FurniturePicker
                id={draft.furnitureDefinitionId}
                name={furnitureName}
                onChange={(id, name) => set({ furnitureDefinitionId: id, furnitureQuantity: id === null ? 0 : Math.max(1, draft.furnitureQuantity) }, name)}
                disabled={disabled}
            />
            <div className="flex flex-col gap-3">
                <Labeled label="How many of it">
                    <Input value={draft.furnitureQuantity} onChange={event => set({ furnitureQuantity: digits(event.target.value) })} inputMode="numeric" disabled={disabled || draft.furnitureDefinitionId === null} />
                </Labeled>
                <Labeled label="Badge" hint="A badge code to give, such as ADM.">
                    <Input value={draft.badgeCode ?? ''} onChange={event => set({ badgeCode: event.target.value.trim() || null })} className="font-mono" disabled={disabled} />
                </Labeled>
            </div>
            <Labeled label="Uses in all" hint="How many players may redeem it, each once. Empty: any number.">
                <Input value={draft.maxUses ?? ''} onChange={event => set({ maxUses: event.target.value.trim() ? digits(event.target.value) : null })} inputMode="numeric" disabled={disabled} />
            </Labeled>
            <Labeled label="Expires (UTC)" hint="Empty: never.">
                <Input type="datetime-local" value={isoToInput(draft.expiresAt)} onChange={event => set({ expiresAt: inputToIso(event.target.value) })} disabled={disabled} />
            </Labeled>
            <Labeled label="Note" hint="For staff: what it was made for." className="sm:col-span-2">
                <Input value={draft.note} onChange={event => set({ note: event.target.value })} maxLength={255} disabled={disabled} />
            </Labeled>
            <Switch label="Redeemable" hint="Off: refused as if there were no such code." checked={draft.enabled} onChange={enabled => set({ enabled })} disabled={disabled} />
        </div>
    );
};

const draftOf = (item: VoucherItem | null): VoucherDraft => {
    if (!item) return EMPTY;

    const voucher = item.voucher;

    return Object.fromEntries(Object.keys(EMPTY).map(key => [ key, voucher[key as keyof VoucherDraft] ])) as VoucherDraft;
};

/** Who redeemed a voucher, newest first. */
const Redemptions = ({ id }: { id: number }) => {
    const { data, error } = useVoucherRedemptions(id);

    if (error) return <ErrorNotice error={error} />;
    if (!data) return null;
    if (data.redemptions.length === 0) return <p className="text-sm text-muted">Nobody has redeemed it yet.</p>;

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted">Redeemed by</span>
            <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
                {data.redemptions.map(x => (
                    <li key={x.playerId} className="flex items-center gap-3 px-3 py-1.5">
                        <Link to={`/players/${x.playerId}`} className="min-w-0 flex-1 truncate hover:underline">{x.playerName || `#${x.playerId}`}</Link>
                        <span className="text-xs text-muted tabular-nums">{utc(x.redeemedAt)} UTC</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

/** One voucher: its code and what it gives; with who has redeemed it. */
const VoucherEditor = ({ item, onDone, disabled }: { item: VoucherItem | null; onDone: () => void; disabled?: boolean }) => {
    const [ draft, setDraft ] = useState(() => draftOf(item));
    const [ furnitureName, setFurnitureName ] = useState(item?.furnitureName ?? null);
    const save = useSaveVoucher();
    const remove = useDeleteVoucher();
    const set = (change: Partial<VoucherDraft>, name?: string | null) => {
        setDraft(previous => ({ ...previous, ...change }));
        if (name !== undefined) setFurnitureName(name);
    };

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ ...draft, id: item?.voucher.id ?? null }, { onSuccess: () => !item && onDone() });
            }}
        >
            <Labeled label="Code" hint="What players type in the catalogue, in any case: letters, digits, - and _.">
                <Input value={draft.code} onChange={event => set({ code: event.target.value.replace(/\s/g, '').toUpperCase() })} className="font-mono" maxLength={64} disabled={disabled} autoFocus={!item} />
            </Labeled>
            <RewardFields draft={draft} furnitureName={furnitureName} set={set} disabled={disabled} />
            {!disabled && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" icon={item ? <Save /> : <Plus />} disabled={save.isPending || !draft.code}>{item ? 'Save' : 'Add'}</Button>
                    <Button variant="ghost" icon={<X />} onClick={onDone}>{item ? 'Close' : 'Cancel'}</Button>
                    {item && (
                        <Button
                            variant="ghost"
                            icon={<Trash2 />}
                            className="ml-auto text-bad hover:text-bad"
                            disabled={remove.isPending}
                            onClick={() => ask({ title: `Delete the voucher ${item.voucher.code}?`, body: 'Who redeemed it is forgotten too.', confirm: 'Delete' }, () => remove.mutate(item.voucher.id, { onSuccess: onDone }))}
                        >
                            Delete
                        </Button>
                    )}
                </div>
            )}
            {save.isSuccess && item && <SuccessNotice>Saved.</SuccessNotice>}
            {(save.error ?? remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
            {item && <Redemptions id={item.voucher.id} />}
        </form>
    );
};

/** Many vouchers like one, each with its own random code: to hand out one a player. */
const Generator = ({ onDone }: { onDone: () => void }) => {
    const [ draft, setDraft ] = useState<VoucherDraft>(EMPTY);
    const [ furnitureName, setFurnitureName ] = useState<string | null>(null);
    const [ count, setCount ] = useState(10);
    const [ prefix, setPrefix ] = useState('');
    const [ copied, setCopied ] = useState(false);
    const generate = useGenerateVouchers();
    const codes = generate.data?.vouchers.map(x => x.voucher.code).join('\n') ?? '';
    const set = (change: Partial<VoucherDraft>, name?: string | null) => {
        setDraft(previous => ({ ...previous, ...change }));
        if (name !== undefined) setFurnitureName(name);
    };

    const download = () => {
        const link = document.createElement('a');

        link.href = URL.createObjectURL(new Blob([ `${codes}\n` ], { type: 'text/plain' }));
        link.download = `vouchers-${prefix.toLowerCase() || 'batch'}.txt`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    if (generate.data)
        return (
            <div className="flex flex-col gap-3">
                <SuccessNotice>Made {generate.data.vouchers.length} vouchers.</SuccessNotice>
                <textarea readOnly value={codes} rows={Math.min(12, generate.data.vouchers.length)} className="rounded-lg border border-line bg-canvas p-3 font-mono text-sm" />
                <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" icon={<Copy />} onClick={() => void navigator.clipboard.writeText(codes).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</Button>
                    <Button variant="secondary" icon={<Download />} onClick={download}>Download</Button>
                    <Button variant="ghost" icon={<X />} onClick={onDone}>Close</Button>
                </div>
            </div>
        );

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                generate.mutate({ count, prefix, voucher: draft });
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                <Labeled label="How many">
                    <Input value={count} onChange={event => setCount(digits(event.target.value))} inputMode="numeric" autoFocus />
                </Labeled>
                <Labeled label="Prefix" hint="Before each random code, such as XMAS-. Codes never hold I, L, O or W, as the client tells players.">
                    <Input value={prefix} onChange={event => setPrefix(event.target.value.replace(/\s/g, '').toUpperCase())} className="font-mono" maxLength={32} />
                </Labeled>
            </div>
            <RewardFields draft={draft} furnitureName={furnitureName} set={set} />
            <div className="flex flex-wrap items-center gap-2">
                <Button type="submit" icon={<Sparkles />} disabled={generate.isPending || count < 1}>Make {count} vouchers</Button>
                <Button variant="ghost" icon={<X />} onClick={onDone}>Cancel</Button>
            </div>
            {generate.error && <ErrorNotice error={generate.error} />}
        </form>
    );
};

/**
 * Vouchers: codes players type in the catalogue's voucher box for credits, another currency,
 * furniture or a badge. Each player redeems one once; a voucher's uses in all can be limited.
 */
export const VouchersPage = () => {
    const [ text, setText ] = useState('');
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<number | 'new' | 'generate' | null>(null);
    const { data, error } = useVouchers(useDebounced(text.trim()), page);
    const currencies = useCatalogTree().data?.currencies ?? [];
    const currencyName = (id: number) => currencies.find(x => x.id === id)?.name ?? `currency #${id}`;
    const canManage = data?.canManage ?? false;
    const [ now ] = useState(() => Date.now());

    return (
        <>
            <PageHeader title="Catalog" tabs={catalogTabs('vouchers')} description={data ? `${data.total} voucher${data.total === 1 ? '' : 's'}` : 'Codes players redeem in the catalogue'}>
                {canManage && (
                    <>
                        <Button variant="secondary" icon={<Sparkles />} onClick={() => setOpen('generate')} disabled={open === 'generate'}>Make many</Button>
                        <Button icon={<Plus />} onClick={() => setOpen('new')} disabled={open === 'new'}>New voucher</Button>
                    </>
                )}
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {open === 'generate' && <Panel title="Make many vouchers" description="Each its own random code, giving the same."><div className="p-4"><Generator onDone={() => setOpen(null)} /></div></Panel>}
                <Panel className="overflow-clip">
                    <ListToolbar watch={[ text, page ]} page={{ offset: page * (data?.pageSize ?? 50), limit: data?.pageSize ?? 50, total: data?.total, onChange: offset => setPage(Math.floor(offset / (data?.pageSize ?? 50))) }}>
                        <SearchInput
                            value={text}
                            onValueChange={(value) => {
                                setText(value);
                                setPage(0);
                            }}
                            placeholder="Find by code or note"
                            className="min-w-48 flex-1"
                        />
                    </ListToolbar>
                    {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                    {!data && !error && <Loading />}
                    {open === 'new' && <div className="border-b border-line bg-subtle/40 p-4"><VoucherEditor item={null} onDone={() => setOpen(null)} /></div>}
                    {data && data.vouchers.length === 0 && open !== 'new' && <EmptyState>{text.trim() ? 'No voucher matches.' : 'No vouchers yet.'}</EmptyState>}
                    <ul className="divide-y divide-line">
                        {data?.vouchers.map((item) => {
                            const voucher = item.voucher;
                            const expired = (isoTime(voucher.expiresAt) ?? Infinity) <= now;
                            const usedUp = voucher.maxUses !== null && voucher.uses >= voucher.maxUses;

                            return (
                                <li key={voucher.id}>
                                    <button type="button" onClick={() => setOpen(open === voucher.id ? null : voucher.id)} className={cx('flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-subtle', open === voucher.id && 'bg-subtle/60')}>
                                        <span className="font-mono text-sm">{voucher.code}</span>
                                        <span className="min-w-0 flex-1 truncate text-xs text-muted">{rewards(item, currencyName)}{voucher.note ? ` · ${voucher.note}` : ''}</span>
                                        <span className="text-xs text-muted tabular-nums">{voucher.uses}{voucher.maxUses === null ? '' : ` / ${voucher.maxUses}`} used</span>
                                        {voucher.expiresAt && !expired && <Badge>until {utc(voucher.expiresAt)}</Badge>}
                                        {!voucher.enabled && <Badge tone="amber">Off</Badge>}
                                        {expired && <Badge tone="red">Expired</Badge>}
                                        {usedUp && <Badge>Used up</Badge>}
                                    </button>
                                    {open === voucher.id && <div className="border-t border-line bg-subtle/40 p-4"><VoucherEditor key={voucher.id} item={item} onDone={() => setOpen(null)} disabled={!canManage} /></div>}
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
            </PageBody>
        </>
    );
};
