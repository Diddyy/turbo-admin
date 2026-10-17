import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { cx } from '#/lib/cx';

export interface TabItem {
    value: string;
    label: ReactNode;
    icon?: ReactNode;
    /** Shown beside the label, e.g. how many items the tab holds. */
    count?: number;
    /** What the tab is for, on hover. */
    title?: string;
    /** The page the tab opens. Tabs with one are links; tabs without one switch by `onChange`. */
    to?: string;
}

interface TabsProps {
    value: string | undefined;
    tabs: TabItem[];
    onChange?: (value: string) => void;
    /** Ids for the tabs and the panels they control, for a tab row that switches content in place. */
    ids?: { tab: (value: string) => string; panel: (value: string) => string };
    /** Draw the row's own bottom rule; off where the row sits on another line (the page header's). */
    rule?: boolean;
    /** What the row is, for screen readers. */
    label?: string;
    className?: string;
}

type Line = { left: number; width: number };

/**
 * Where each set of tabs last had its line, by the tabs it holds. A page's header tabs are drawn
 * again on the next page, and the line glides on from where it was instead of appearing.
 */
const lastLines = new Map<string, Line>();

const tabClass = (active: boolean) => cx(
    'flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors [&>svg]:size-4',
    active ? 'text-accent' : 'text-muted hover:text-ink',
);

const Count = ({ count, active }: { count: number; active: boolean }) => (
    <span className={cx('rounded-full px-1.5 text-[11px] tabular-nums transition-colors', active ? 'bg-accent-soft text-accent' : 'bg-subtle text-muted')}>
        {count.toLocaleString()}
    </span>
);

/**
 * A row of tabs with the chosen one underlined; the line slides from tab to tab as the choice
 * moves. Tabs that switch in place follow the WAI-ARIA tabs pattern: one stop for Tab, and the
 * arrow keys (with Home and End) move between them. Tabs with a `to` are links to their pages.
 */
export const Tabs = ({ value, tabs, onChange, ids, rule = true, label, className }: TabsProps) => {
    const list = useRef<HTMLDivElement>(null);
    const group = tabs.map(tab => tab.value).join('|');
    const [ line, setLine ] = useState<Line | null>(() => lastLines.get(group) ?? null);

    // Measured when the choice changes and whenever the chosen tab's size does (a count that grows).
    useEffect(() => {
        const active = list.current?.querySelector<HTMLElement>('[data-active]');

        if (!active)
            return;

        const observer = new ResizeObserver(() => {
            const measured = { left: active.offsetLeft, width: active.offsetWidth };

            lastLines.set(group, measured);
            setLine(measured);
        });

        observer.observe(active);

        // A row wider than a phone scrolls sideways: the chosen tab is brought into sight. Only the
        // row moves; scrollIntoView would scroll the window too, to a row below the fold.
        const row = list.current;

        if (row) {
            const start = active.offsetLeft;
            const end = start + active.offsetWidth;

            if (start < row.scrollLeft)
                row.scrollLeft = start;
            else if (end > row.scrollLeft + row.clientWidth)
                row.scrollLeft = end - row.clientWidth;
        }

        return () => observer.disconnect();
    }, [ value, group ]);

    const handleKeyDown = (event: KeyboardEvent, index: number) => {
        const next = {
            ArrowRight: index + 1,
            ArrowLeft: index - 1,
            Home: 0,
            End: tabs.length - 1,
        }[event.key];

        if (next === undefined)
            return;

        event.preventDefault();

        const target = (next + tabs.length) % tabs.length;
        const tab = tabs[target];

        if (!tab)
            return;

        onChange?.(tab.value);
        list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
    };

    const linked = tabs.some(tab => tab.to !== undefined);

    return (
        <div
            ref={list}
            role={linked ? undefined : 'tablist'}
            aria-label={label}
            // Its rule is a shadow, not a border, so the line sits on it rather than under it.
            className={cx('no-scrollbar relative flex gap-1 overflow-x-auto', rule && 'shadow-[inset_0_-1px_0_var(--color-line)]', className)}
        >
            {tabs.map((tab, index) => {
                const active = tab.value === value;
                const content = (
                    <>
                        {tab.icon}
                        {tab.label}
                        {tab.count !== undefined && <Count count={tab.count} active={active} />}
                    </>
                );

                return tab.to !== undefined
                    ? (
                            <Link
                                key={tab.value}
                                to={tab.to}
                                title={tab.title}
                                aria-current={active ? 'page' : undefined}
                                data-active={active || undefined}
                                className={tabClass(active)}
                            >
                                {content}
                            </Link>
                        )
                    : (
                            <button
                                key={tab.value}
                                type="button"
                                role="tab"
                                id={ids?.tab(tab.value)}
                                aria-selected={active}
                                aria-controls={ids?.panel(tab.value)}
                                tabIndex={active ? 0 : -1}
                                title={tab.title}
                                data-active={active || undefined}
                                onClick={() => onChange?.(tab.value)}
                                onKeyDown={event => handleKeyDown(event, index)}
                                className={tabClass(active)}
                            >
                                {content}
                            </button>
                        );
            })}
            {line && (
                <span
                    aria-hidden
                    className="pointer-events-none absolute bottom-0 h-0.5 rounded-full bg-accent transition-all duration-300 ease-out"
                    style={{ left: line.left, width: line.width }}
                />
            )}
        </div>
    );
};
