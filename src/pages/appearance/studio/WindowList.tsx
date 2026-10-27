import { ChevronDown, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useTextSearch } from '#/api/gamedata';
import type { TemplateIndex, WindowElement, WindowTemplate } from '#/api/windows';
import { SearchInput } from '#/components/SearchInput';
import { cx } from '#/lib/cx';
import { useDebounced } from '#/lib/debounce';

import { AREAS, type StudioWindow, windowMatches } from './windows';

const THUMB_WIDTH = 44;
const THUMB_HEIGHT = 32;

/** How deep the outline draws a window's elements: its frame, its panes and their contents. */
const THUMB_DEPTH = 3;

/** A window's outline, drawn from its layout: its frame and the boxes inside it, scaled down. */
const Thumbnail = ({ template }: { template: WindowTemplate | undefined }) => {
    if (!template || !template.width || !template.height) return <span className="inline-block shrink-0 rounded-sm border border-dashed border-line" style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }} />;

    const scale = Math.min(THUMB_WIDTH / template.width, THUMB_HEIGHT / template.height);
    const boxes: { rect: WindowElement['rect']; depth: number }[] = [];
    const visit = (elements: readonly WindowElement[], depth: number, x: number, y: number) => {
        for (const element of elements) {
            if (element.hidden || depth > THUMB_DEPTH) continue;

            const rect: WindowElement['rect'] = [ x + element.rect[0], y + element.rect[1], element.rect[2], element.rect[3] ];

            boxes.push({ rect, depth });
            visit(element.children ?? [], depth + 1, rect[0], rect[1]);
        }
    };

    visit(template.elements, 0, 0, 0);

    return (
        <svg width={THUMB_WIDTH} height={THUMB_HEIGHT} className="shrink-0" aria-hidden>
            <g transform={`translate(${(THUMB_WIDTH - (template.width * scale)) / 2} ${(THUMB_HEIGHT - (template.height * scale)) / 2}) scale(${scale})`}>
                {boxes.map(({ rect, depth }, at) => (
                    <rect key={at} x={rect[0]} y={rect[1]} width={rect[2]} height={rect[3]} vectorEffect="non-scaling-stroke" className={depth === 0 ? 'fill-subtle stroke-muted' : 'fill-none stroke-line'} strokeWidth={1} />
                ))}
            </g>
        </svg>
    );
};

/**
 * The windows players see, by area, with what they call them and their outline: found by name, or
 * by what they show (a caption's words, an element of a part drawn inside them).
 */
export const WindowList = ({ index, windows, value, onPick }: { index: TemplateIndex; windows: readonly StudioWindow[]; value: string | null; onPick: (id: string) => void }) => {
    const [ text, setText ] = useState('');
    const words = useDebounced(text).trim().toLowerCase();
    const [ closed, setClosed ] = useState<ReadonlySet<string>>(new Set());
    // The keys of the hotel's texts showing the words: a window showing one is found by what it shows.
    const { data: texts } = useTextSearch(words.length >= 3 ? words : '', 0);
    const shown = useMemo(() => new Set(words.length >= 3 ? texts?.items.map(item => item.key) ?? [] : []), [ texts, words ]);
    const found = useMemo(() => windows.filter(window => windowMatches(index, window, words, shown)), [ index, windows, words, shown ]);
    const byArea = Map.groupBy([ ...found ].sort((a, b) => a.name.localeCompare(b.name)), window => window.area);

    return (
        <div className="flex min-h-0 flex-col">
            <div className="flex shrink-0 flex-col gap-1 border-b border-line p-2">
                <SearchInput value={text} onValueChange={setText} placeholder="A window, or what it shows" aria-label="Find a window" />
                <span className="text-xs text-muted">{`${found.length} of ${windows.length} windows${shown.size ? `, ${shown.size} text(s) say those words` : ''}`}</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {AREAS.filter(area => byArea.has(area)).map((area) => {
                    const open = !!words || !closed.has(area);

                    return (
                        <section key={area} aria-label={area}>
                            <button
                                type="button"
                                aria-expanded={open}
                                className="sticky top-0 z-10 flex w-full items-center gap-1 border-b border-line bg-surface px-2 py-1.5 text-left text-xs font-medium text-muted uppercase"
                                onClick={() => setClosed(was => (was.has(area) ? new Set([ ...was ].filter(each => each !== area)) : new Set([ ...was, area ])))}
                            >
                                {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                {area}
                                <span className="ml-auto tabular-nums">{byArea.get(area)!.length}</span>
                            </button>
                            {open && (
                                <ul>
                                    {byArea.get(area)!.map(window => (
                                        <li key={window.id}>
                                            <button
                                                type="button"
                                                title={window.id}
                                                aria-current={window.id === value ? 'true' : undefined}
                                                className={cx('flex w-full items-center gap-2 px-2 py-1 text-left text-[13px] hover:bg-subtle', window.id === value && 'bg-subtle text-accent')}
                                                onClick={() => onPick(window.id)}
                                            >
                                                <Thumbnail template={window.template} />
                                                <span className="truncate">{window.name}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    );
                })}
            </div>
        </div>
    );
};
