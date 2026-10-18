import { Check, Image, Type } from 'lucide-react';
import { useState } from 'react';

import { Modal } from '#/components/Modal';
import { SearchInput } from '#/components/SearchInput';
import { Chip, Label } from '#/components/ui';
import { cx } from '#/lib/cx';

import { isKnownLayout, LAYOUT_GROUPS, LAYOUTS } from './layouts';

/**
 * Picking a page's layout from what the client can draw, grouped by what it is for: each with what
 * it shows, how many pictures and words it takes, and its code. Any other code can still be typed,
 * for a client that has more templates.
 */
export const LayoutPicker = ({ value, open, extra, onPick, onClose }: { value: string; open: boolean; extra: string[]; onPick: (layout: string) => void; onClose: () => void }) => {
    const [ filter, setFilter ] = useState('');
    const needle = filter.trim().toLowerCase();
    const shown = LAYOUTS.filter(x => !needle || x.code.includes(needle) || x.title.toLowerCase().includes(needle) || x.blurb.toLowerCase().includes(needle));
    const others = extra.filter(code => !isKnownLayout(code) && (!needle || code.includes(needle)));
    const custom = needle && /^[a-z0-9_-]+$/.test(needle) && !LAYOUTS.some(x => x.code === needle) && !extra.includes(needle);

    const pick = (code: string) => {
        onPick(code);
        onClose();
    };

    return (
        <Modal title="Pick a layout" open={open} onClose={onClose} className="sm:max-w-4xl">
            <div className="flex flex-col gap-4 p-4">
                <SearchInput value={filter} onValueChange={setFilter} placeholder="Find a layout, or type a code" aria-label="Find a layout" autoFocus />
                {custom && (
                    <button type="button" onClick={() => pick(needle)} className="self-start rounded-lg border border-dashed border-line px-3 py-2 text-left text-sm hover:border-accent">
                        Use <span className="font-mono">{needle}</span>, a layout this list doesn't know
                    </button>
                )}
                {LAYOUT_GROUPS.map((group) => {
                    const items = shown.filter(x => x.group === group);

                    return items.length > 0 && (
                        <section key={group} className="flex flex-col gap-2">
                            <Label as="h3">{group}</Label>
                            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {items.map(layout => (
                                    <li key={layout.code}>
                                        <button
                                            type="button"
                                            onClick={() => pick(layout.code)}
                                            className={cx(
                                                'flex h-full w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md',
                                                layout.code === value ? 'border-accent bg-accent-soft' : 'border-line bg-canvas',
                                            )}
                                        >
                                            <span className="flex items-center gap-2">
                                                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{layout.title}</span>
                                                {layout.code === value && <Check className="size-4 shrink-0 text-accent" />}
                                            </span>
                                            <span className="text-xs leading-snug text-muted">{layout.blurb}</span>
                                            <span className="mt-auto flex items-center gap-3 pt-1 text-[11px] text-muted">
                                                <span className="font-mono">{layout.code}</span>
                                                <span className="ml-auto flex items-center gap-1" title="Pictures"><Image className="size-3" />{layout.images.length}</span>
                                                <span className="flex items-center gap-1" title="Texts"><Type className="size-3" />{layout.texts.length}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    );
                })}
                {others.length > 0 && (
                    <section className="flex flex-col gap-2">
                        <Label as="h3">Other</Label>
                        <p className="text-xs text-muted">Codes the hotel lists (Turbo:Admin:CatalogLayouts) or pages use, that this list doesn't describe.</p>
                        <div className="flex flex-wrap gap-1.5">
                            {others.map(code => (
                                <Chip key={code} active={code === value} onClick={() => pick(code)} className="font-mono">
                                    {code}
                                </Chip>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </Modal>
    );
};
