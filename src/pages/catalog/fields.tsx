import { Coins } from 'lucide-react';

import type { CatalogTree } from '#/api/catalog';
import { Input, Select } from '#/components/ui';
import { cx } from '#/lib/cx';

import { pagesInOrder } from './tree';

/** A drop-down of every page, indented as the tree is; pages whose layout shows no offers are marked. */
export const PageSelect = ({ tree, value, onChange, className, placeholder = 'Pick a page…' }: { tree: CatalogTree; value: number | null; onChange: (id: number | null) => void; className?: string; placeholder?: string }) => (
    <Select value={value ?? ''} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)} aria-label="Page" className={cx('min-w-0', className)}>
        <option value="">{placeholder}</option>
        {pagesInOrder(tree).map(x => (
            <option key={x.id} value={x.id}>
                {`${'  '.repeat(x.depth)}${x.title}${x.sells ? '' : ' (shows no offers)'}`}
            </option>
        ))}
    </Select>
);

export interface Price {
    costCredits: number;
    costCurrency: number;
    currencyTypeId: number | null;
}

/** Credits, and a second price in one of the hotel's activity-point currencies. */
export const PriceFields = ({ tree, value, onChange }: { tree: CatalogTree; value: Price; onChange: (price: Price) => void }) => (
    <div className="flex items-center gap-1.5">
        <div className="relative w-24 shrink-0">
            <Coins className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-coin" />
            <Input type="number" min={0} value={value.costCredits} onChange={event => onChange({ ...value, costCredits: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} className="w-full pl-8 font-mono" aria-label="Credits" title="Credits" />
        </div>
        {tree.currencies.length > 0 && (
            <>
                <span className="text-xs text-muted">+</span>
                <Input type="number" min={0} value={value.costCurrency} onChange={event => onChange({ ...value, costCurrency: Math.max(0, Math.floor(Number(event.target.value) || 0)) })} className="w-20 shrink-0 font-mono" aria-label="Currency amount" />
                <Select value={value.currencyTypeId ?? ''} onChange={event => onChange({ ...value, currencyTypeId: event.target.value ? Number(event.target.value) : null })} aria-label="Currency" className="min-w-0">
                    <option value="">points…</option>
                    {tree.currencies.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </Select>
            </>
        )}
    </div>
);
