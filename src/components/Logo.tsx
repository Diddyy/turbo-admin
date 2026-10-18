import { cx } from '#/lib/cx';

/** The mark: a slanted T in the accent's tile, with the lines of its speed trailing behind it. */
export const LogoMark = ({ className }: { className?: string }) => (
    <span
        aria-hidden
        className={cx(
            'grid shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--color-accent)_78%,white),var(--color-accent)_55%,color-mix(in_srgb,var(--color-accent)_80%,black))] text-on-accent shadow-[0_6px_16px_-6px] shadow-accent/70 ring-1 ring-white/15 ring-inset',
            className,
        )}
    >
        <svg viewBox="0 0 24 24" className="size-[62%]" fill="currentColor">
            <g transform="translate(2.4 0) skewX(-12)">
                <rect x="8" y="4.5" width="13" height="3.6" rx="1.8" />
                <rect x="12.7" y="4.5" width="3.6" height="15" rx="1.8" />
                <rect x="1.5" y="10.2" width="8.5" height="2.2" rx="1.1" opacity="0.7" />
                <rect x="3.5" y="14.6" width="6.5" height="2.2" rx="1.1" opacity="0.45" />
            </g>
        </svg>
    </span>
);

/** The mark and the name beside it: "Turbo", and under it what this is. */
export const Logo = ({ className }: { className?: string }) => (
    <span className={cx('flex items-center gap-2.5', className)}>
        <LogoMark className="size-9" />
        <span className="flex flex-col">
            <span className="text-[15px] leading-tight font-semibold tracking-tight text-ink">Turbo</span>
            <span className="font-mono text-[10px] leading-tight font-medium tracking-[0.16em] text-muted uppercase">Admin</span>
        </span>
    </span>
);
