import { Dices, Pencil } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { IconButton, Input, Labeled } from '#/components/ui';
import { cx } from '#/lib/cx';
import { SAMPLE_LOOKS } from '#/preview/avatar';

/**
 * Who says the stage's bubble, and what: a pencil in the stage's corner that opens the speaker's
 * name, words and look over it. The bubble is drawn again as they change. Escape, a click away or
 * the pencil again closes it.
 */
export const SpeakerEditor = ({ name, onName, words, onWords, figure, onFigure, unavailable }: {
    name: string;
    onName: (name: string) => void;
    words: string;
    onWords: (words: string) => void;
    figure: string;
    onFigure: (figure: string) => void;
    /** Why their head can't be drawn, when it can't. */
    unavailable?: string | null;
}) => {
    const [ open, setOpen ] = useState(false);
    const box = useRef<HTMLDivElement>(null);
    const look = useRef<HTMLInputElement>(null);

    // A look typed is taken once it is finished - on Enter, on leaving the field, or as this closes -
    // so the imager is asked for a head once, not at every key.
    const takeLook = () => {
        const value = look.current?.value.trim();

        if (value && value !== figure)
            onFigure(value);
    };

    const close = () => {
        takeLook();
        setOpen(false);
    };

    // The listeners below close with the look as it is now, not as it was when they were added.
    const closeFromListener = useEffectEvent(close);

    useEffect(() => {
        if (!open)
            return;

        const away = (event: MouseEvent) => {
            if (!box.current?.contains(event.target as Node))
                closeFromListener();
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                closeFromListener();
        };

        document.addEventListener('mousedown', away);
        window.addEventListener('keydown', onKey);

        return () => {
            document.removeEventListener('mousedown', away);
            window.removeEventListener('keydown', onKey);
        };
    }, [ open ]);

    return (
        <div ref={box} className="relative">
            <button
                type="button"
                onClick={() => (open ? close() : setOpen(true))}
                title="Who says it, and what"
                aria-label="Who says it, and what"
                aria-expanded={open}
                className={cx(
                    'grid size-10 place-items-center rounded-lg border bg-surface/90 shadow-sm backdrop-blur transition-colors sm:size-8 [&>svg]:size-4',
                    open ? 'border-accent text-accent' : 'border-line text-muted hover:text-ink',
                )}
            >
                <Pencil />
            </button>
            {open && (
                <div className="absolute top-full right-0 z-20 mt-2 flex w-80 max-w-[calc(100vw-3rem)] animate-rise flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-xl">
                    <Labeled label="Who says it">
                        <Input value={name} onChange={event => onName(event.target.value)} placeholder="A name" className="w-full" autoFocus />
                    </Labeled>
                    <Labeled label="What they say">
                        <Input value={words} onChange={event => onWords(event.target.value)} placeholder="Some words" className="w-full" />
                    </Labeled>
                    <Labeled label="Their look" hint={unavailable ?? 'Their head is drawn in the bubble; their shirt tints a coloured one.'}>
                        <span className="flex items-center gap-1.5">
                            <Input
                                key={figure}
                                ref={look}
                                defaultValue={figure}
                                onBlur={takeLook}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter')
                                        event.currentTarget.blur();
                                }}
                                spellCheck={false}
                                className="w-full min-w-0 font-mono text-xs"
                            />
                            <IconButton label="Another look" icon={<Dices />} onClick={() => onFigure(SAMPLE_LOOKS[(SAMPLE_LOOKS.indexOf(figure) + 1) % SAMPLE_LOOKS.length]!)} />
                        </span>
                    </Labeled>
                </div>
            )}
        </div>
    );
};
