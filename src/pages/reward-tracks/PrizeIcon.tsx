import { Armchair, Bot, Coins, MessageCircle, PawPrint, Smile, Sparkles } from 'lucide-react';

import type { RewardTrackPrize } from '#/api/rewardTracks';
import { cx } from '#/lib/cx';
import { ProductIcon } from '#/pages/catalog/ProductIcon';

import { currencyName, type FurniNames } from './model';

const GLYPHS: Partial<Record<number, typeof Bot>> = { 0: Armchair, 1: Armchair, 2: Sparkles, 6: Bot, 8: Coins, 9: MessageCircle, 10: PawPrint, 12: Smile };

/**
 * A prize's picture: the furni's icon or the badge, as the client shows them; the other kinds a
 * symbol with their id (a furni the hotel has no furni of shows its sprite), since the panel has no Habbicon, effect or pet art.
 */
export const PrizeIcon = ({ prize, furni, className }: { prize: RewardTrackPrize; furni: FurniNames; className?: string }) => {
    if ((prize.productType === 0 || prize.productType === 1) && furni.has(prize.id))
        return <ProductIcon type={prize.productType === 0 ? 'wall' : 'floor'} name={furni.get(prize.id) ?? null} className={className} />;

    if (prize.productType === 4)
        return <ProductIcon type="badge" name={prize.rewardTypeId} className={className} />;

    const Glyph = GLYPHS[prize.productType] ?? Sparkles;

    return (
        <span className={cx('flex size-8 shrink-0 flex-col items-center justify-center', className)}>
            <Glyph className="size-1/2 min-h-4 min-w-4 text-accent" aria-hidden />
            {prize.productType !== 6 && prize.productType !== 10 && (
                <span className="max-w-full truncate font-mono text-[9px] leading-none text-muted">{prize.productType === 8 ? currencyName(prize.rewardTypeId) : prize.rewardTypeId}</span>
            )}
        </span>
    );
};
