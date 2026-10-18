import { MoreHorizontal } from 'lucide-react';
import { Children, Fragment, isValidElement, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { cx } from '#/lib/cx';

/** What a page's title keeps of its header row, however many actions the page has (18rem). */
const TITLE_MIN_WIDTH = 288;

/** The gap between the actions (gap-2), and between the header row's parts (gap-x-3). */
const GAP = 8;
const ROW_GAP = 12;

/** The "More" button's width (size-8) and its gap. */
const MORE_WIDTH = 32 + GAP;

/** A fragment's children are actions each, however deep: what fits is counted one action at a time. */
const flatten = (nodes: ReactNode): ReactNode[] => Children.toArray(nodes).flatMap(child =>
    isValidElement(child) && child.type === Fragment ? flatten((child.props as { children?: ReactNode }).children) : [ child ]);

/**
 * A page's actions, in one row beside its title, as nitro-studio has them: as many as fit, the rest
 * under "More". The title always keeps its share of the row, and the actions never wrap onto a line
 * of their own, so the header stays one height. Each action is measured in a copy of the row nobody
 * sees, and the row again as the window changes. The last actions are kept longest: a page's main
 * action is its last.
 */
export const HeaderActions = ({ children }: { children: ReactNode }) => {
    const items = flatten(children);
    const box = useRef<HTMLDivElement>(null);
    const ruler = useRef<HTMLDivElement>(null);
    const menu = useRef<HTMLDivElement>(null);
    const [ shown, setShown ] = useState(items.length);
    const [ open, setOpen ] = useState(false);

    useLayoutEffect(() => {
        const row = box.current?.parentElement;

        if (!row)
            return;

        const measure = () => {
            // The row, less its other parts (the menu button, back, the icon, search) and what the title keeps.
            const others = [ ...row.children ]
                .filter(child => child !== box.current && !(child as HTMLElement).dataset.title && (child as HTMLElement).offsetWidth > 0)
                .reduce((sum, child) => sum + (child as HTMLElement).offsetWidth + ROW_GAP, 0);
            const available = row.clientWidth - others - Math.min(TITLE_MIN_WIDTH, row.clientWidth / 2) - ROW_GAP;
            const widths = [ ...(ruler.current?.children ?? []) ].map(child => (child as HTMLElement).offsetWidth);
            const total = widths.reduce((sum, width, index) => sum + width + (index ? GAP : 0), 0);

            if (total <= available) {
                setShown(widths.length);

                return;
            }

            let used = 0;
            let count = 0;

            for (let index = widths.length - 1; index >= 0; index--) {
                const next = used + widths[index]! + (count ? GAP : 0);

                if (next + MORE_WIDTH > available)
                    break;

                used = next;
                count++;
            }

            setShown(count);
        };

        const observer = new ResizeObserver(measure);

        observer.observe(row);

        if (ruler.current)
            observer.observe(ruler.current);

        return () => observer.disconnect();
    }, [ items.length ]);

    useEffect(() => {
        if (!open)
            return;

        const away = (event: MouseEvent) => {
            if (!menu.current?.contains(event.target as Node))
                setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                setOpen(false);
        };

        document.addEventListener('mousedown', away);
        window.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', away);
            window.removeEventListener('keydown', onKey);
        };
    }, [ open ]);

    const hidden = items.slice(0, items.length - shown);
    const visible = items.slice(items.length - shown);

    return (
        <div ref={box} className="relative flex shrink-0 items-center justify-end gap-2">
            {/* The row as it would be, whole, measured out of sight. */}
            <div ref={ruler} aria-hidden inert className="pointer-events-none invisible absolute top-0 right-0 flex w-max gap-2">
                {items}
            </div>
            {hidden.length > 0 && (
                <div ref={menu} className="relative">
                    <button
                        type="button"
                        onClick={() => setOpen(!open)}
                        title="More actions"
                        aria-label="More actions"
                        aria-expanded={open}
                        className={cx(
                            'grid size-10 place-items-center rounded-lg border border-line bg-subtle text-muted transition-colors hover:text-ink sm:size-8 [&>svg]:size-4',
                            open && 'border-accent text-accent',
                        )}
                    >
                        <MoreHorizontal />
                    </button>
                    {open && (
                        <div
                            onClick={() => setOpen(false)}
                            className="absolute top-full right-0 z-40 mt-2 flex min-w-48 animate-rise flex-col items-stretch gap-1.5 rounded-xl border border-line bg-surface p-1.5 shadow-xl [&>a]:justify-start [&>button]:justify-start"
                        >
                            {hidden}
                        </div>
                    )}
                </div>
            )}
            {visible}
        </div>
    );
};
