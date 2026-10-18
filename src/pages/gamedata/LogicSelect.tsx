import { Check, ChevronDown, Search } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

import { cx } from '#/lib/cx';

/** Logics of the room's avatars, not furniture's. */
const AVATAR_LOGICS = new Set([ 'default_avatar', 'default_bot', 'default_pet' ]);

const WIRED_PREFIX = 'wf_';

interface Option {
    value: string;
    group: string;
}

/** The logics in groups: furniture's, then the wired boxes' (each named as its classname). */
const optionsOf = (logics: string[], current: string): Option[] => {
    const usable = logics.filter(x => !AVATAR_LOGICS.has(x));
    const options: Option[] = [];

    if (current && !usable.includes(current))
        options.push({ value: current, group: 'Not registered' });

    options.push(...usable.filter(x => !x.startsWith(WIRED_PREFIX)).map(value => ({ value, group: 'Furniture' })));
    options.push(...usable.filter(x => x.startsWith(WIRED_PREFIX)).map(value => ({ value, group: 'Wired' })));

    return options;
};

/**
 * A drop-down of the room object logics the server has registered, found by typing: furniture's
 * first, then the wired boxes'. A name none registered can still be kept (the furniture then
 * behaves as plain furniture), typed in and taken with Enter.
 */
export const LogicSelect = ({ value, logics, onChange, disabled }: { value: string; logics: string[] | undefined; onChange: (value: string) => void; disabled?: boolean }) => {
    const [ open, setOpen ] = useState(false);
    const [ text, setText ] = useState('');
    const [ active, setActive ] = useState(0);
    const box = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const id = useId();
    const registered = !logics || logics.includes(value);

    const shown = useMemo(() => {
        const words = text.trim().toLowerCase();
        const all = optionsOf(logics ?? [], value);
        const found = words ? all.filter(x => x.value.toLowerCase().includes(words)) : all;

        // Typed and not a logic: offered as it is, to keep a name of the hotel's own.
        if (words && !all.some(x => x.value === text.trim()))
            found.push({ value: text.trim(), group: 'Use as typed' });

        return found;
    }, [ logics, text, value ]);

    // Closes on a click anywhere else.
    useEffect(() => {
        if (!open)
            return;

        const close = (event: PointerEvent) => {
            if (!box.current?.contains(event.target as Node))
                setOpen(false);
        };

        document.addEventListener('pointerdown', close);

        return () => document.removeEventListener('pointerdown', close);
    }, [ open ]);

    // The active option stays in sight as the arrows move it.
    useEffect(() => {
        list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [ active ]);

    const show = () => {
        setText('');
        setActive(Math.max(0, optionsOf(logics ?? [], value).findIndex(x => x.value === value)));
        setOpen(true);
    };

    const pick = (option: Option | undefined) => {
        if (!option)
            return;

        onChange(option.value);
        setOpen(false);
    };

    const keys = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(current => Math.min(shown.length - 1, current + 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(current => Math.max(0, current - 1));
        } else if (event.key === 'Enter') {
            event.preventDefault();
            pick(shown[active]);
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
        }
    };

    return (
        <div ref={box} className="relative">
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={`${id}-list`}
                onClick={() => (open ? setOpen(false) : show())}
                className={cx(
                    'flex h-10 w-full items-center gap-2 rounded-lg border bg-canvas px-2.5 text-left text-[15px] sm:h-8 sm:text-[13px]',
                    'focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:opacity-60',
                    open ? 'border-accent' : 'border-line hover:border-muted/50',
                )}
            >
                <span className={cx('min-w-0 flex-1 truncate font-mono', !value && 'text-muted')}>{value || 'Pick a logic'}</span>
                {!registered && <span className="shrink-0 rounded bg-warn-soft px-1.5 text-[11px] font-medium text-warn">not registered</span>}
                <ChevronDown className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
            </button>

            {open && (
                <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
                    <div className="flex items-center gap-2 border-b border-line px-3">
                        <Search className="size-4 shrink-0 text-muted" aria-hidden />
                        <input
                            autoFocus
                            value={text}
                            onChange={(event) => {
                                setText(event.target.value);
                                setActive(0);
                            }}
                            onKeyDown={keys}
                            placeholder={`Find among ${(logics?.filter(x => !AVATAR_LOGICS.has(x)).length ?? 0).toLocaleString()} logics`}
                            role="combobox"
                            aria-expanded
                            aria-controls={`${id}-list`}
                            aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}
                            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
                        />
                    </div>
                    <ul ref={list} id={`${id}-list`} role="listbox" className="max-h-72 overflow-y-auto py-1">
                        {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">{logics ? 'No logic by that name.' : 'Loading the logics…'}</li>}
                        {shown.map((option, index) => (
                            <li key={`${option.group}:${option.value}`} role="presentation">
                                {(index === 0 || shown[index - 1]!.group !== option.group) && (
                                    <div className="px-3 pt-2 pb-1 font-mono text-[10.5px] font-medium tracking-[0.08em] text-muted uppercase">{option.group}</div>
                                )}
                                <div
                                    id={`${id}-${index}`}
                                    data-index={index}
                                    role="option"
                                    aria-selected={option.value === value}
                                    onPointerEnter={() => setActive(index)}
                                    onClick={() => pick(option)}
                                    className={cx(
                                        'mx-1 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[13px]',
                                        index === active ? 'bg-accent-soft text-accent' : 'text-ink',
                                    )}
                                >
                                    <span className="min-w-0 flex-1 truncate">{option.value}</span>
                                    {option.value === value && <Check className="size-3.5 shrink-0" aria-hidden />}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};
