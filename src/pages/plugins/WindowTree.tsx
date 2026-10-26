import { useEffect, useRef } from 'react';
import { Link } from 'react-router';

import type { WindowElement } from '#/api/windows';
import { cx } from '#/lib/cx';

import type { TestElement } from './windowTest';

/** A text key's page: Texts & variables, found and open. */
const textLink = (key: string) => `/gamedata/texts?${new URLSearchParams({ q: key, open: key })}`;

/** A skin's place in the skins gallery. */
const skinLink = (skin: string) => `/appearance/windows/skins?${new URLSearchParams({ skin })}`;

interface TreeProps {
    elements: readonly (WindowElement | TestElement)[];
    /** The skins an element draws, by its key. */
    skinsOf?: (key: string) => string[];
    /** Picking an element's key: a new patch on it. */
    onPick?: (key: string) => void;
    /** The element pointed at in a preview: its row is marked and scrolled to. */
    selected?: string | null;
    /** The row under the pointer, by its element's key (null on leaving): what a preview outlines. */
    onHover?: (key: string | null) => void;
    depth?: number;
}

const Row = ({ element, skinsOf, onPick, selected, onHover, depth }: { element: TestElement } & Omit<TreeProps, 'elements'>) => {
    const key = element.key;
    const skins = (key !== undefined && skinsOf?.(key)) || [];
    const row = useRef<HTMLDivElement>(null);
    const isSelected = (key !== undefined) && (selected === key);

    useEffect(() => {
        if (isSelected) row.current?.scrollIntoView({ block: 'nearest' });
    }, [ isSelected ]);

    return (
        <li>
            <div
                ref={row}
                className={cx('flex flex-wrap items-baseline gap-x-2 gap-y-0.5 py-0.5 text-[13px]', element.added && 'text-good', element.moved && 'text-accent', element.set && 'bg-warn/10', isSelected && 'bg-accent/15', onHover && (key !== undefined) && 'hover:bg-subtle')}
                style={{ paddingLeft: `${(depth ?? 0) * 1.1}rem` }}
                onMouseEnter={onHover && (key !== undefined) ? () => onHover(key) : undefined}
                onMouseLeave={onHover && (key !== undefined) ? () => onHover(null) : undefined}
            >
                {key !== undefined
                    ? (
                            <button type="button" disabled={!onPick} className="font-mono text-accent enabled:hover:underline disabled:text-ink" title={onPick ? 'New patch on this element' : undefined} onClick={() => onPick?.(key)}>
                                {key === '' ? '\'\' (the window)' : key}
                            </button>
                        )
                    : <span className="font-mono text-muted" title="No key reaches it: a patch can't name it">(no key)</span>}
                <span className="text-muted">{element.tag}</span>
                {element.style !== undefined && <span className="text-xs text-muted">{`style ${element.style}`}</span>}
                {element.name && element.name !== key && <span className="font-mono text-xs">{element.name}</span>}
                {element.caption && <span className="truncate text-xs" title="caption">{`"${element.caption}"`}</span>}
                {element.texts?.map(text => <Link key={text} to={textLink(text)} className="font-mono text-xs text-accent hover:underline" title="Edit this text">{`text: ${text}`}</Link>)}
                {skins.map(skin => <Link key={skin} to={skinLink(skin)} className="text-xs text-accent hover:underline" title="This skin's sprites">{`skin ${skin}`}</Link>)}
                {element.hidden && <span className="text-xs text-muted">hidden</span>}
                <span className="text-[11px] text-muted">{element.rect.join(', ')}</span>
                {element.added && <span className="text-xs">new</span>}
                {element.moved && <span className="text-xs">moved</span>}
                {element.set && <span className="font-mono text-xs text-warn">{`set ${JSON.stringify(element.set)}`}</span>}
                {element.binds?.map((bind, index) => <span key={index} className="font-mono text-xs text-warn">{`bind ${JSON.stringify(bind)}`}</span>)}
            </div>
            {element.children && element.children.length > 0 && <WindowTree elements={element.children} skinsOf={skinsOf} onPick={onPick} selected={selected} onHover={onHover} depth={(depth ?? 0) + 1} />}
        </li>
    );
};

/**
 * A window's elements as a patch names them: each one's key (picked, a new patch on it), tag, style,
 * name, caption, the text keys it shows and the skins it draws, each a link to edit it; a tested
 * patch's changes marked. Beside a preview, hovering a row outlines its element there and the
 * element picked there is marked here.
 */
export const WindowTree = ({ elements, skinsOf, onPick, selected, onHover, depth }: TreeProps) => (
    <ul>
        {elements.map((element, index) => <Row key={`${element.key ?? ''}-${index}`} element={element} skinsOf={skinsOf} onPick={onPick} selected={selected} onHover={onHover} depth={depth} />)}
    </ul>
);
