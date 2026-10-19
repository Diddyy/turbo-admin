import { type RefCallback, useCallback } from 'react';

/** The least a panel is made, however short the window: below it the page scrolls instead. */
const LEAST = 256;

/** The space the page keeps below an element: its margin, and the padding and borders of all it sits in. */
const spaceBelow = (element: HTMLElement) => {
    let space = parseFloat(getComputedStyle(element).marginBottom) || 0;

    for (let at = element.parentElement; at && at !== document.documentElement; at = at.parentElement) {
        const style = getComputedStyle(at);

        space += (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0) + (parseFloat(style.marginBottom) || 0);
    }

    return space;
};

/**
 * Lets a panel beside an editor (a list to pick from) reach the bottom of the window and no further,
 * so its list scrolls inside it rather than the page scrolling for it. It sets `--fill-height` on
 * the element, from where it sits to the window's bottom less the page's own space below it; the
 * element takes it with `lg:max-h-(--fill-height)` (or the breakpoint it sits beside the editor
 * from, given as `query`), as a flex column whose list has `min-h-0`. A sticky panel follows the
 * page as it scrolls, so it fills the window once it sticks; any other fills it where it starts.
 * Below the breakpoint the panel keeps a height of its own.
 */
export const useFillHeight = <T extends HTMLElement>(query = '(min-width: 64rem)'): RefCallback<T> => useCallback((element: T | null) => {
    if (!element)
        return;

    const wide = window.matchMedia(query);
    let frame = 0;

    const measure = () => {
        frame = 0;

        if (!wide.matches) {
            element.style.removeProperty('--fill-height');

            return;
        }

        const style = getComputedStyle(element);
        const sticky = style.position === 'sticky';
        const rect = element.getBoundingClientRect();
        // Stuck or not, a sticky panel is never higher than where it sticks.
        const top = sticky ? Math.max(rect.top, parseFloat(style.top) || 0) : rect.top + window.scrollY;
        const height = Math.max(LEAST, Math.floor(window.innerHeight - top - spaceBelow(element)));

        element.style.setProperty('--fill-height', `${height}px`);
    };

    const later = () => {
        if (!frame)
            frame = requestAnimationFrame(measure);
    };

    // What is above it can grow or shrink too (a notice, a toolbar wrapping), moving it.
    const resized = new ResizeObserver(later);

    resized.observe(document.body);
    window.addEventListener('scroll', later, { passive: true });
    window.addEventListener('resize', later);
    wide.addEventListener('change', later);
    measure();

    return () => {
        cancelAnimationFrame(frame);
        resized.disconnect();
        window.removeEventListener('scroll', later);
        window.removeEventListener('resize', later);
        wide.removeEventListener('change', later);
    };
}, [ query ]);
