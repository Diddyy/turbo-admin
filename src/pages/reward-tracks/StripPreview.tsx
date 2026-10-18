import { ChevronsLeft, ChevronsRight, Lock } from 'lucide-react';
import { useState } from 'react';

import type { RewardTrack, RewardTrackPrize } from '#/api/rewardTracks';
import { IconButton } from '#/components/ui';

import { buildPrizeLayout, PRIZE_CONTENT_WIDTH, PRIZE_WIDTH } from './layout';
import { css, type FurniNames, prizeText, themeOf } from './model';
import { PrizeIcon } from './PrizeIcon';

/** The rows of `reward_track_main_xml`'s prize strip, in pixels as the client lays them out. */
const LABEL_WIDTH = 100;
const ARROW_WIDTH = 40;
const ROW_HEIGHT = 80;
const BAR_HEIGHT = 26;
const TICKS_HEIGHT = 24;
const BOX = 54;
const PREMIUM_ROW = '#ead7f2';

/** One prize's box, centred on its points as `RewardTrackPrizeView` places it. */
const PrizeBox = ({ prize, x, top, furni, locked }: { prize: RewardTrackPrize; x: number; top: number; furni: FurniNames; locked: boolean }) => (
    <div
        className="absolute grid place-items-center rounded-md border-2 border-black/15 bg-white/70 shadow-sm"
        style={{ left: x - (BOX / 2), top: top + ((ROW_HEIGHT - BOX) / 2), width: BOX, height: BOX }}
        title={`${prize.id} · ${prizeText(prize, furni)} · ${prize.requiredPoints.toLocaleString()} points`}
    >
        <PrizeIcon prize={prize} furni={furni} className="size-9" />
        {prize.amount > 1 && (
            <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded bg-black/45 px-1 font-mono text-[9px] leading-tight text-white">{prize.amount.toLocaleString()}</span>
        )}
        {locked && <Lock className="absolute -right-1.5 -bottom-1.5 size-4 rounded bg-white p-0.5 text-[#555]" aria-label="Premium" />}
    </div>
);

/**
 * The track's prize strip as the client draws it for a player with no points and no premium: the
 * free prizes above the bar, the premium ones below, a page of the client's own width at a time
 * (`RewardTrackPrizeLayout`). Positions and pages are the client's; the art is the panel's.
 */
export const StripPreview = ({ track, furni, title }: { track: RewardTrack; furni: FurniNames; title: string | null }) => {
    const layout = buildPrizeLayout(track.prizes);
    const [ wanted, setWanted ] = useState(0);
    const page = Math.min(wanted, layout.pageCount - 1);
    const theme = themeOf(track.theme);
    const onPage = track.prizes.filter(prize => layout.pageForPoints(prize.requiredPoints) === page);
    const points = [ ...new Set(onPage.map(prize => prize.requiredPoints)) ].sort((a, b) => a - b);
    const height = (ROW_HEIGHT * 2) + BAR_HEIGHT + TICKS_HEIGHT;
    const barTop = ROW_HEIGHT + (BAR_HEIGHT / 2) - 4;
    const first = points.length > 0 ? layout.xForPoints(points[0]!, page) : 0;

    return (
        <div className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-xl border border-line" style={{ background: css(theme.medium) }}>
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white" style={{ background: css(theme.dark) }}>
                    {title ?? track.id}
                    <span className="ml-auto font-mono text-[11px] font-normal opacity-80">{track.theme || 'blue'}</span>
                </div>
                <div className="relative mx-3 my-3 flex text-[#222]" style={{ width: LABEL_WIDTH + PRIZE_CONTENT_WIDTH + (ARROW_WIDTH * 2), height }}>
                    <div className="flex shrink-0 flex-col gap-0" style={{ width: LABEL_WIDTH }}>
                        <div className="grid place-items-center rounded-l-lg text-center text-xs font-semibold" style={{ height: ROW_HEIGHT, background: css(theme.light) }}>Free Track</div>
                        <div style={{ height: BAR_HEIGHT }} />
                        <div className="grid place-items-center rounded-l-lg text-center text-xs font-semibold" style={{ height: ROW_HEIGHT, background: PREMIUM_ROW }}>
                            <span>Premium<br /><span className="font-normal text-[#555]">Extra rewards</span></span>
                        </div>
                    </div>
                    <div className="grid shrink-0 place-items-center" style={{ width: ARROW_WIDTH, height: ROW_HEIGHT * 2 + BAR_HEIGHT }}>
                        <IconButton label="Page before" icon={<ChevronsLeft />} disabled={page === 0} onClick={() => setWanted(page - 1)} />
                    </div>
                    <div className="relative shrink-0 overflow-hidden" style={{ width: PRIZE_CONTENT_WIDTH, height }} data-testid="prize-strip">
                        <div className="absolute inset-x-0 top-0" style={{ height: ROW_HEIGHT, background: css(theme.light) }} />
                        <div className="absolute inset-x-0" style={{ top: ROW_HEIGHT + BAR_HEIGHT, height: ROW_HEIGHT, background: track.premium ? PREMIUM_ROW : 'transparent' }} />
                        <div className="absolute h-2 rounded-full bg-[#7a7a7a]" style={{ left: Math.min(first, 0), right: 0, top: barTop }} />
                        {points.map((value) => {
                            const x = layout.xForPoints(value, page);

                            return (
                                <div key={value}>
                                    <span className="absolute size-4 rounded-full border-2 border-[#7a7a7a] bg-white" style={{ left: x - 8, top: barTop - 4 }} />
                                    <span className="absolute w-0 border-l border-dashed border-[#b55]" style={{ left: x, top: ROW_HEIGHT * 2 + BAR_HEIGHT, height: 8 }} />
                                    <span className="absolute -translate-x-1/2 font-mono text-[11px] tabular-nums" style={{ left: x, top: ROW_HEIGHT * 2 + BAR_HEIGHT + 8 }}>{value.toLocaleString()}</span>
                                </div>
                            );
                        })}
                        {onPage.map(prize => (
                            <PrizeBox
                                key={prize.id}
                                prize={prize}
                                x={layout.xForPoints(prize.requiredPoints, page)}
                                top={prize.premium ? ROW_HEIGHT + BAR_HEIGHT : 0}
                                furni={furni}
                                locked={prize.premium}
                            />
                        ))}
                    </div>
                    <div className="grid shrink-0 place-items-center" style={{ width: ARROW_WIDTH, height: ROW_HEIGHT * 2 + BAR_HEIGHT }}>
                        <IconButton label="Page after" icon={<ChevronsRight />} disabled={page >= layout.pageCount - 1} onClick={() => setWanted(page + 1)} />
                    </div>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                <span>
                    Page <span className="font-semibold text-ink">{page + 1}</span> of {layout.pageCount} · {layout.pagePointSpan.toLocaleString()} points a page · {PRIZE_WIDTH} px prizes on a {PRIZE_CONTENT_WIDTH} px strip
                </span>
            </div>
            {track.prizes.length === 0 && <p className="text-xs text-muted">No prizes yet: the strip is empty.</p>}
        </div>
    );
};
