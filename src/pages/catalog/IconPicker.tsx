import { Ban } from 'lucide-react';
import { useState } from 'react';

import { catalogIconUrl, useClientAssets } from '#/api/assets';
import { Modal } from '#/components/Modal';
import { Button, Input } from '#/components/ui';
import { cx } from '#/lib/cx';

/** How many icon numbers are offered: Habbo's go a little past 300; more can be typed. */
const ICON_COUNT = 400;

/**
 * Picking a page's icon from the client's own icon_<n>.png, by sight: every number the client's
 * host has an icon for, the current one marked. One the host lacks drops out of the grid, so
 * only icons that draw are offered. A number can be typed too.
 */
export const IconPicker = ({ value, open, onPick, onClose }: { value: number; open: boolean; onPick: (icon: number) => void; onClose: () => void }) => {
    const assets = useClientAssets();
    const [ missing, setMissing ] = useState<Set<number>>(() => new Set());
    const [ typed, setTyped ] = useState('');

    const pick = (icon: number) => {
        onPick(icon);
        onClose();
    };
    const number = typed.trim() === '' ? NaN : Number(typed);
    const pickTyped = () => {
        if (number >= 0)
            pick(Math.floor(number));
    };

    return (
        <Modal title="Pick an icon" open={open} onClose={onClose}>
            <div className="flex flex-col gap-3 p-4">
                {/* Not a form: the picker is drawn inside the page editor's, and a form in a form submits the page's (a reload) on Enter. */}
                <div className="flex items-center gap-2">
                    <Input
                        type="number"
                        min={0}
                        value={typed}
                        onChange={event => setTyped(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                pickTyped();
                            }
                        }}
                        placeholder="Or type a number"
                        aria-label="Icon number"
                        className="min-w-0 flex-1 font-mono sm:w-44 sm:flex-none"
                    />
                    <Button variant="secondary" disabled={!(number >= 0)} onClick={pickTyped}>OK</Button>
                    <span className="text-xs text-muted">Now {value > 0 ? `icon ${value}` : 'none'}.</span>
                </div>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1.5">
                    <li>
                        <button
                            type="button"
                            onClick={() => pick(0)}
                            title="No icon"
                            className={cx('grid aspect-square w-full place-items-center rounded-lg border text-muted hover:border-accent hover:text-accent', value === 0 ? 'border-accent bg-accent-soft' : 'border-line')}
                        >
                            <Ban className="size-4" />
                        </button>
                    </li>
                    {Array.from({ length: ICON_COUNT }, (_, i) => i + 1)
                        .filter(icon => !missing.has(icon))
                        .map((icon) => {
                            const url = catalogIconUrl(assets, icon);

                            return url && (
                                <li key={icon}>
                                    <button
                                        type="button"
                                        onClick={() => pick(icon)}
                                        title={`Icon ${icon}`}
                                        className={cx(
                                            'grid aspect-square w-full place-items-center rounded-lg border transition hover:scale-110 hover:border-accent hover:bg-accent-soft',
                                            value === icon ? 'border-accent bg-accent-soft' : 'border-line bg-canvas',
                                        )}
                                    >
                                        <img
                                            src={url}
                                            alt={`Icon ${icon}`}
                                            loading="lazy"
                                            className="max-h-6 max-w-6 [image-rendering:pixelated]"
                                            onError={() => setMissing(current => new Set(current).add(icon))}
                                        />
                                    </button>
                                </li>
                            );
                        })}
                </ul>
                {!assets?.catalogIcon && <p className="text-sm text-muted">The panel doesn't know where the client's icons are (Turbo:Admin:ClientConfigUrl), so type a number.</p>}
            </div>
        </Modal>
    );
};
