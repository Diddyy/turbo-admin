import { CheckCircle2, Menu, XCircle } from 'lucide-react';
import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type Ref, type SelectHTMLAttributes, type TextareaHTMLAttributes, useState } from 'react';
import { Link } from 'react-router';

import { useClientAssets } from '#/api/assets';
import { useDrawer } from '#/layout/drawer';
import { HotelStatusPill } from '#/layout/HotelStatus';
import { useActiveNavItem } from '#/layout/nav';
import { NotificationsBell } from '#/layout/NotificationsBell';
import { cx } from '#/lib/cx';
import { avatarUrl } from '#/preview/avatar';

import { BackArrow } from './BackArrow';
import { HeaderActions } from './HeaderActions';
import { type TabItem, Tabs } from './Tabs';

/** The width every page's content keeps to, header and body alike. */
const PAGE_WIDTH = 'mx-auto w-full max-w-[1240px]';

interface PageHeaderProps {
    title: string;
    /** A line under the title: what the page shows right now, or what it is for. */
    description?: ReactNode;
    /** Where the arrow before the title goes, for a page under another (a room, under Rooms). */
    back?: { to: string; label: string };
    /** The page's tabs, along the header's bottom edge. */
    tabs?: { items: TabItem[]; value: string; onChange?: (value: string) => void };
    /** Buttons and badges beside the title. */
    children?: ReactNode;
}

/**
 * The top of every page, in the bar along the top of the window as nitro-studio has it: the title
 * and a line under it; the page's actions to the right (actions that do not fit go under "More");
 * and along its bottom edge the page's tabs (or, with none, the page's name marked as a tab is, so
 * every header is the same height). On a phone it stays at the top as an app bar, with the menu's
 * button before the title and the hotel's state at a glance and the bell after it; from a laptop
 * up it scrolls away with the page, and the search and the bell sit in the sidebar.
 */
export const PageHeader = ({ title, description, back, tabs, children }: PageHeaderProps) => {
    return (
        <header className="sticky top-0 z-30 border-b border-line bg-chrome/95 backdrop-blur lg:static lg:z-auto lg:bg-chrome lg:backdrop-blur-none">
            <div className={cx(PAGE_WIDTH, 'flex min-h-14 items-center gap-x-2.5 px-3 py-2 sm:gap-x-3 sm:px-4 lg:min-h-17 lg:px-6')}>
                <MenuButton />
                <BackArrow back={back} />
                <HeaderIcon />
                <div data-title className="min-w-0 flex-1">
                    <h1 className="truncate text-base leading-7 font-semibold tracking-tight lg:text-lg">{title}</h1>
                    {description && (
                        <p className="truncate text-[13px] leading-5 text-muted" title={typeof description === 'string' ? description : undefined}>
                            {description}
                        </p>
                    )}
                </div>
                {children && <HeaderActions>{children}</HeaderActions>}
                <HotelStatusPill />
                <div className="lg:hidden">
                    <NotificationsBell />
                </div>
            </div>
            {/* The tabs' row: its tabs' line sits on the header's own bottom rule. */}
            <div className={cx(PAGE_WIDTH, 'flex h-10 items-end px-2 sm:px-4 lg:px-6', !tabs && 'max-lg:hidden')}>
                {/* Words only, on every page: the page's icon is the one beside its title. */}
                {tabs
                    ? <Tabs value={tabs.value} tabs={tabs.items.map(tab => ({ ...tab, icon: undefined }))} onChange={tabs.onChange} rule={false} className="-mb-px min-w-0" />
                    : <HeaderPage title={title} />}
            </div>
        </header>
    );
};

/** On a phone and a tablet, the button that slides the menu in from the left. */
const MenuButton = () => {
    const setOpen = useDrawer(state => state.setOpen);

    return (
        <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Menu"
            className="-ml-1 grid size-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-subtle hover:text-ink lg:hidden [&>svg]:size-5"
        >
            <Menu />
        </button>
    );
};

/** The page's navigation entry's icon in a tile, before its title. Not on a phone, where the row is the title's. */
const HeaderIcon = () => {
    const entry = useActiveNavItem();

    if (!entry)
        return null;

    return <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent max-sm:hidden [&>svg]:size-5">{entry.icon}</span>;
};

/** A page with no tabs, where its tabs would be: its name, marked as the chosen tab is. */
const HeaderPage = ({ title }: { title: string }) => (
    <span className="-mb-px flex shrink-0 items-center border-b-2 border-accent px-3 py-2 text-sm font-medium whitespace-nowrap text-accent">
        {title}
    </span>
);

/**
 * A link in a page's header that looks like the header's buttons: from a room or a player to their
 * chat, commands, permissions or profile.
 */
export const HeaderLink = ({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) => (
    <Link to={to} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-subtle px-3 text-sm font-medium hover:border-muted/50 sm:h-8 sm:text-[13px] [&>svg]:size-4">
        {icon}
        {children}
    </Link>
);

/**
 * The page under its header, to the same width. `still` leaves out its rising entrance, for a page
 * with drag and drop: a transformed parent would move the drag overlay.
 */
export const PageBody = ({ children, className, still }: { children: ReactNode; className?: string; still?: boolean }) => (
    <div className={cx(PAGE_WIDTH, !still && 'animate-rise', 'px-3 py-4 sm:px-4 lg:px-6 lg:py-6', className)}>{children}</div>
);

interface PanelProps {
    title?: ReactNode;
    /** A short line under the title. */
    description?: ReactNode;
    actions?: ReactNode;
    children: ReactNode;
    className?: string;
    ref?: Ref<HTMLElement>;
}

export const Panel = ({ title, description, actions, children, className, ref }: PanelProps) => (
    <section ref={ref} className={cx('rounded-xl border border-line bg-surface', className)}>
        {(title || actions) && (
            <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
                {/* Shrinks to 8rem, its description wrapping, before the actions drop below it. */}
                <div className="min-w-0 flex-[1_1_8rem]">
                    {title && <h2 className="text-[13px] font-semibold tracking-wide">{title}</h2>}
                    {description && <div className="mt-0.5 text-xs text-muted">{description}</div>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
            </header>
        )}
        {children}
    </section>
);

/**
 * A small uppercase label in the mono face: what a number or a group is, or (`as="h3"`) the
 * heading over a group of fields, rows or tiles.
 */
export const Label = ({ as: Tag = 'span', children, className }: { as?: 'span' | 'div' | 'h3'; children: ReactNode; className?: string }) => (
    <Tag className={cx('font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase', className)}>{children}</Tag>
);

/**
 * A number worth a glance, in the mono face, with what it is above it. `meter` (0 to 1) draws how
 * full it is under it; `tone` colours a number that needs attention. `compact` for a row of
 * figures inside a tool (what a plan would make), smaller than a page's own.
 */
export const Stat = ({ label, value, detail, meter, tone, icon, compact }: { label: string; value: ReactNode; detail?: ReactNode; meter?: number; tone?: 'warn' | 'bad'; icon?: ReactNode; compact?: boolean }) => (
    <div className={cx('rounded-xl border border-line bg-surface', compact ? 'px-3 py-2.5' : 'px-4 py-3.5')}>
        <Label className="flex items-center gap-1 [&>svg]:size-3">{icon}{label}</Label>
        <div className={cx('font-mono font-semibold tabular-nums', compact ? 'mt-0.5 text-xl' : 'mt-1.5 text-2xl', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad')}>{value}</div>
        {meter !== undefined && (
            <div className="mt-2.5 h-1 rounded-full bg-line" aria-hidden>
                <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.round(Math.min(1, Math.max(0, meter)) * 100)}%` }} />
            </div>
        )}
        {detail && <div className="mt-1.5 truncate text-xs text-muted">{detail}</div>}
    </div>
);

export type BadgeTone = 'neutral' | 'accent' | 'green' | 'amber' | 'red';

const BADGE_TONES: Record<BadgeTone, string> = {
    neutral: 'border-line text-muted',
    accent: 'border-accent/40 bg-accent-soft text-accent',
    green: 'border-good-line bg-good-soft text-good',
    amber: 'border-warn-line bg-warn-soft text-warn',
    red: 'border-bad-line bg-bad-soft text-bad',
};

/** A tag, in the mono face: a role, a state, a short fact. */
export const Badge = ({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) => (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-medium whitespace-nowrap uppercase', BADGE_TONES[tone], className)}>
        {children}
    </span>
);

/** Whether something is live: a dot and a few words, green when it is. */
export const LiveBadge = ({ live, children }: { live: boolean; children: ReactNode }) => (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs font-medium whitespace-nowrap', live ? 'border-good-line bg-good-soft text-good' : 'border-line text-muted')}>
        <span className={cx('size-1.5 rounded-full', live ? 'bg-good' : 'bg-muted')} />
        {children}
    </span>
);

export const ErrorNotice = ({ error }: { error: unknown }) => (
    <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-bad-line bg-bad-soft px-4 py-3 text-sm text-bad">
        <XCircle className="mt-0.5 size-4 shrink-0" />
        <span>{error instanceof Error ? error.message : 'Something went wrong.'}</span>
    </div>
);

export const SuccessNotice = ({ children }: { children: ReactNode }) => (
    <div role="status" className="flex items-start gap-2.5 rounded-xl border border-good-line bg-good-soft px-4 py-3 text-sm text-good">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">{children}</div>
    </div>
);

export const WarningNotice = ({ children }: { children: ReactNode }) => (
    <div className="rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn">
        {children}
    </div>
);

export const Loading = () => (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-muted">
        <span className="inline-flex items-center gap-1" aria-hidden>
            {[ 0, 1, 2 ].map(index => (
                <span key={index} className="size-1.5 animate-bounce rounded-full bg-accent" style={{ animationDelay: `${index * 0.15}s` }} />
            ))}
        </span>
        Loading
    </div>
);

/**
 * The look every text box and drop-down shares. Every control (a button, a field, a segmented
 * row) is one height: 40px on a phone, a thumb's size, and 32px from a tablet up.
 */
export const FIELD_CLASS = 'h-10 sm:h-8 rounded-lg border border-line bg-canvas px-2.5 text-[15px] sm:text-[13px] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60';

export const Input = ({ className, ...input }: InputHTMLAttributes<HTMLInputElement>) => (
    <input {...input} className={cx(FIELD_CLASS, className ?? 'w-full')} />
);

export const Select = ({ className, ...select }: SelectHTMLAttributes<HTMLSelectElement>) => (
    <select {...select} className={cx(FIELD_CLASS, className)} />
);

export const Textarea = ({ className, ...textarea }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...textarea} className={cx(FIELD_CLASS, 'h-auto py-2 leading-relaxed sm:h-auto', className ?? 'w-full')} />
);

/** A label over any control: a drop-down, a textarea, a row of them. */
export const Labeled = ({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) => (
    <label className={cx('flex flex-col gap-1.5', className)}>
        <span className="text-xs font-medium text-muted">{label}</span>
        {children}
        {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
);

export const Checkbox = ({ label, checked, onChange, disabled, hint }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; hint?: string }) => (
    <label className={cx('flex items-start gap-2 text-sm select-none', disabled && 'opacity-60')}>
        <input
            type="checkbox"
            className="mt-0.5 size-4 rounded border-line accent-accent"
            checked={checked}
            disabled={disabled}
            onChange={event => onChange(event.target.checked)}
        />
        <span>
            {label}
            {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
    </label>
);

/** An on/off switch with its label beside it: a whole row a thumb can hit. */
export const Switch = ({ label, checked, onChange, disabled, hint, className }: { label: ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; hint?: ReactNode; className?: string }) => (
    <label className={cx('flex min-h-10 items-center justify-between gap-4 select-none', disabled ? 'opacity-60' : 'cursor-pointer', className)}>
        <span className="min-w-0">
            <span className="block text-sm">{label}</span>
            {hint && <span className="block text-xs text-muted">{hint}</span>}
        </span>
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={cx(
                'relative h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                checked ? 'bg-accent' : 'bg-line',
            )}
        >
            <span className={cx('absolute top-1 size-4 rounded-full transition-all', checked ? 'left-5 bg-on-accent' : 'left-1 bg-muted')} />
        </button>
    </label>
);

/**
 * A choice of a few, all in sight: a row of buttons, the chosen one raised. For four options or
 * fewer; more belong in a drop-down.
 */
export const Segmented = ({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) => (
    // Each option as wide as its words at least: the row grows past a narrow box rather than cutting them.
    <div role="radiogroup" aria-label={label} className="flex min-w-max gap-0.5 rounded-lg bg-canvas p-0.5">
        {options.map(option => (
            <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={option.value === value}
                disabled={disabled}
                onClick={() => onChange(option.value)}
                className={cx(
                    'h-9 flex-auto rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors sm:h-7',
                    option.value === value ? 'bg-subtle text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink',
                )}
            >
                {option.label}
            </button>
        ))}
    </div>
);

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
    label: string;
    hint?: string;
}

export const Field = ({ label, hint, id, ...input }: FieldProps) => {
    const fieldId = id ?? input.name;

    return (
        <div className="flex flex-col gap-1.5">
            <label htmlFor={fieldId} className="text-xs font-medium text-muted">{label}</label>
            <Input id={fieldId} {...input} />
            {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
    );
};

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
    primary: 'border border-accent bg-accent font-semibold text-on-accent hover:border-accent-hover hover:bg-accent-hover',
    secondary: 'border border-line bg-subtle text-ink hover:border-muted/50',
    ghost: 'border border-transparent text-muted hover:border-line hover:bg-subtle hover:text-ink',
    danger: 'border border-bad-line bg-bad-soft text-bad hover:border-bad/60',
};

export const Button = ({ variant = 'primary', icon, className, children, ...button }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; icon?: ReactNode }) => (
    <button
        type="button"
        {...button}
        className={cx(
            'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 sm:h-8 sm:text-[13px] [&>svg]:size-4',
            BUTTON_VARIANTS[variant],
            className,
        )}
    >
        {icon}
        {children}
    </button>
);

/**
 * A button that is only an icon: named for screen readers and on hover. `small` for a dense row
 * (an item in a list inside a card), still a thumb's size on a phone. `tone="bad"` deletes: muted
 * until pointed at, then red.
 */
export const IconButton = ({ label, icon, tone, small, className, ...button }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: ReactNode; tone?: 'bad'; small?: boolean }) => (
    <button
        type="button"
        title={label}
        aria-label={label}
        {...button}
        className={cx(
            'grid shrink-0 place-items-center rounded-lg border border-transparent transition',
            small ? 'size-10 sm:size-7 [&>svg]:size-3.5' : 'size-10 sm:size-8 [&>svg]:size-4',
            tone === 'bad' ? 'text-muted hover:border-bad-line hover:bg-bad-soft hover:text-bad' : 'text-muted hover:border-line hover:bg-subtle hover:text-ink',
            'disabled:pointer-events-none disabled:opacity-50',
            className,
        )}
    >
        {icon}
    </button>
);

const TEXT_ACTION = 'inline-flex items-center gap-0.5 rounded text-xs font-medium text-accent hover:underline disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-3.5';

/** A small action in words, in the accent: "all", "none", "open all", beside what it acts on. */
export const TextButton = ({ className, ...button }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...button} className={cx(TEXT_ACTION, className)} />
);

/** A small link in words, in the accent: a card's "The whole log ›" or "All settings". */
export const TextLink = ({ to, className, children }: { to: string; className?: string; children: ReactNode }) => (
    <Link to={to} className={cx(TEXT_ACTION, className)}>{children}</Link>
);

/** A pill that is on or off: a quick value to pick, or a filter to narrow a list by. */
export const Chip = ({ active, className, children, ...button }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) => (
    <button
        type="button"
        aria-pressed={active}
        {...button}
        className={cx(
            'inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50 sm:min-h-7',
            active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:border-accent hover:text-accent',
            className,
        )}
    >
        {children}
    </button>
);

/** A fact and its value on one line; `mono` for a value that is code (a hash, a path, an id). */
export const Kv = ({ label, mono, children }: { label: string; mono?: boolean; children: ReactNode }) => (
    <div className="flex items-baseline justify-between gap-4 border-t border-line px-4 py-2.5 text-[13px] first:border-t-0">
        <dt className="shrink-0 text-muted">{label}</dt>
        <dd className={cx('min-w-0 text-right', mono && 'font-mono')}>{children}</dd>
    </div>
);

export const Th = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <th className={cx('border-b border-line px-4 py-2 text-left font-mono text-[11px] font-medium tracking-[0.08em] text-muted uppercase', className)}>{children}</th>
);

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => (
    <td className={cx('border-b border-line px-4 py-2.5 align-middle', className)}>{children}</td>
);

/**
 * What shows where a list has nothing. Inside a card, a line; `framed`, a dashed box of its own
 * for a page or a tool's results area, with `icon` over the words (coloured by the caller).
 */
export const EmptyState = ({ children, icon, framed }: { children: ReactNode; icon?: ReactNode; framed?: boolean }) => (
    framed
        ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-6 py-16 text-center [&>svg]:size-8">
                    {icon}
                    <p className="max-w-md text-sm text-muted">{children}</p>
                </div>
            )
        : <p className="px-4 py-6 text-sm text-muted">{children}</p>
);

/** A player's initials in a coloured tile, the colour picked from their id so it stays theirs. */
export const Avatar = ({ id, name, figure, large, className }: { id: number; name: string; figure?: string; large?: boolean; className?: string }) => {
    const imager = useClientAssets()?.imager;
    const url = figure ? avatarUrl(imager, figure, { size: large ? 'l' : 'n', headOnly: true, crop: true, direction: 2, headDirection: 2 }) : null;
    const [ failed, setFailed ] = useState<string | null>(null);
    const drawn = url !== null && failed !== url;

    return (
        <span
            aria-hidden
            className={cx('grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg font-mono text-xs font-semibold text-[#0a0e13] sm:size-10', className)}
            style={{ background: drawn ? `color-mix(in srgb, ${AVATAR_COLOURS[Math.abs(id) % AVATAR_COLOURS.length]} 35%, var(--color-subtle))` : AVATAR_COLOURS[Math.abs(id) % AVATAR_COLOURS.length] }}
        >
            {/* Their head as the client draws it, from the hotel's imager; their initials without one. */}
            {drawn
                ? <img key={url} src={url} alt="" loading="lazy" className="max-w-none [image-rendering:pixelated]" onError={() => setFailed(url)} />
                : name.slice(0, 2).toUpperCase()}
        </span>
    );
};

const AVATAR_COLOURS = [ '#7FE3DA', '#B79CFF', '#F2B55A', '#9CC3FF', '#FFB4A2', '#A6E3A1' ];
