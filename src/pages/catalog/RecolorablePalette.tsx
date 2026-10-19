import { Hammer, Palette, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { type CatalogOffer, type PageDisplay, useRecolorablePalettes } from '#/api/catalog';
import { cx } from '#/lib/cx';

import { inBuildersClub } from './labels';

/** The furni an offer places: its first floor or wall item, as the client's palette reads it. */
const furniOf = (offer: CatalogOffer) => offer.products.find(x => (x.type === 'floor' || x.type === 'wall') && x.definitionName)?.definitionName ?? null;

/**
 * Under a `recolorable_furniture` page's grid, as the client's palette: the colours the picked
 * offer's furni (else the first offer's) can be placed in, from the hotel's palette settings.
 * Picking one shows what a builder sees picked. It says when the page can't be reached - the layout
 * has no buy button, only the Builders Club's placing - and which offers' furni takes no colour.
 */
export const RecolorablePalette = ({ offers, selectedOffer, display }: { offers: CatalogOffer[]; selectedOffer: number | 'new' | null; display: PageDisplay | undefined }) => {
    const names = [ ...new Set(offers.map(furniOf).filter((x): x is string => !!x)) ];
    const palettes = useRecolorablePalettes(names).data;
    const [ picked, setPicked ] = useState<string | null>(null);
    const offer = offers.find(x => x.id === selectedOffer) ?? offers[0];
    const furni = offer ? furniOf(offer) : null;
    const colours = furni ? palettes?.[furni] ?? [] : [];
    const plain = palettes
        ? offers.filter((x) => {
                const name = furniOf(x);

                return !name || !palettes[name];
            })
        : [];
    const chosen = picked && colours.includes(picked) ? picked : colours[0];

    return (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
            {display && !inBuildersClub(display) && (
                <p className="flex items-start gap-1.5 rounded-lg bg-warn-soft px-2.5 py-1.5 text-xs text-ink">
                    <Hammer className="mt-px size-3.5 shrink-0 text-warn" />
                    This layout has no buy button: its furni are placed from the Builders Club. Show the page in the Builders Club catalog for builders to reach it.
                </p>
            )}
            <div className="flex items-center gap-2 text-xs">
                <Palette className="size-3.5 text-accent" />
                <span className="font-medium">Palette</span>
                {furni && <span className="truncate font-mono text-muted">{furni}</span>}
                {colours.length > 0 && <span className="ml-auto text-muted">{colours.length} colours</span>}
            </div>
            {colours.length > 0
                ? (
                        <ul className="flex flex-wrap gap-1" aria-label={`The colours of ${furni}`}>
                            {colours.map(colour => (
                                <li key={colour}>
                                    <button
                                        type="button"
                                        title={`#${colour}`}
                                        aria-label={`#${colour}`}
                                        aria-pressed={colour === chosen}
                                        onClick={() => setPicked(colour)}
                                        style={{ backgroundColor: `#${colour}` }}
                                        className={cx('block h-5 w-6 rounded-sm border border-black/20', colour === chosen && 'ring-2 ring-accent ring-offset-1 ring-offset-canvas')}
                                    />
                                </li>
                            ))}
                        </ul>
                    )
                : (
                        <p className="text-xs text-muted">
                            {!offer ? 'Add offers of recolorable furni (the *_recolorable building blocks) to show their palette.' : !palettes ? 'Loading the palette…' : `${furni ?? 'This offer'} takes no colour: it isn't recolorable, or its palette is empty.`}
                        </p>
                    )}
            {plain.length > 0 && colours.length > 0 && (
                <p className="flex items-start gap-1.5 text-xs text-muted">
                    <TriangleAlert className="mt-px size-3.5 shrink-0 text-warn" />
                    {`${plain.length} ${plain.length === 1 ? 'offer places furni' : 'offers place furni'} that takes no colour: ${plain.map(x => furniOf(x) ?? `offer ${x.id}`).slice(0, 3).join(', ')}${plain.length > 3 ? '…' : ''}`}
                </p>
            )}
        </div>
    );
};
