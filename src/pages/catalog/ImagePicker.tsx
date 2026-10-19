import { ChevronDown, Search, Upload, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';

import { type CatalogImage, findImage, useAllCatalogImages, useUploadCatalogImage } from '#/api/catalogImages';
import { toast, toastError } from '#/components/toast';
import { cx } from '#/lib/cx';

import { CatalogImageThumb } from './CatalogImageThumb';

/** How many matches the list draws at once; typing more narrows it. */
const SHOWN = 60;

interface Option {
    value: string;
    image: CatalogImage | null;
    group: string;
}

const usedOn = (image: CatalogImage) =>
    image.pages.length === 0 ? 'on no page' : image.pages.length === 1 ? 'on 1 page' : `on ${image.pages.length} pages`;

/**
 * A catalog picture, found by typing among the files in the server's catalog pictures folder,
 * each drawn beside its name with how many pages show it. A name the folder has no file for can
 * still be kept, typed in and taken with Enter; and one who may change
 * the catalog can upload a picture from here, named as typed, which is then picked.
 */
export const ImagePicker = ({ id, value, onChange, disabled, canUpload }: { id: string; value: string; onChange: (value: string) => void; disabled?: boolean; canUpload: boolean }) => {
    const [ open, setOpen ] = useState(false);
    const [ text, setText ] = useState('');
    const [ active, setActive ] = useState(0);
    const box = useRef<HTMLDivElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const fileInput = useRef<HTMLInputElement>(null);
    const listId = useId();
    const all = useAllCatalogImages();
    const upload = useUploadCatalogImage();
    const images = all.data?.items;
    const current = findImage(images, value);

    const { shown, more } = useMemo(() => {
        const words = text.trim().toLowerCase();
        const found = (images ?? []).filter(x => !words || x.name.toLowerCase().includes(words));

        // Those whose name starts with what is typed come first.
        if (words)
            found.sort((a, b) => Number(!a.name.toLowerCase().startsWith(words)) - Number(!b.name.toLowerCase().startsWith(words)));

        const options: Option[] = found.slice(0, SHOWN).map(image => ({ value: image.name, image, group: words ? 'Matches' : 'Pictures' }));

        // Typed and not a picture the server has: offered as it is, to name one it will have.
        if (words && !findImage(images, text.trim()))
            options.push({ value: text.trim(), image: null, group: 'Use as typed' });

        return { shown: options, more: Math.max(0, found.length - SHOWN) };
    }, [ images, text ]);

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
        setActive(0);
        setOpen(true);
    };

    const pick = (option: Option | undefined) => {
        if (!option)
            return;

        onChange(option.value);
        setOpen(false);
    };

    const take = (file: File) => {
        const name = text.trim();

        upload.mutate({ file, name }, {
            onSuccess: (image) => {
                toast(`Uploaded ${image.file}. Publish the assets for players to see it.`);
                onChange(image.name);
                setOpen(false);
            },
            onError: toastError,
        });
    };

    const keys = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive(at => Math.min(shown.length - 1, at + 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive(at => Math.max(0, at - 1));
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
            <div className="flex items-center gap-1">
                <button
                    id={id}
                    type="button"
                    disabled={disabled}
                    aria-haspopup="listbox"
                    aria-expanded={open}
                    aria-controls={listId}
                    onClick={() => (open ? setOpen(false) : show())}
                    className={cx(
                        'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-canvas px-2 py-1 text-left text-[15px] sm:min-h-8 sm:text-[13px]',
                        'focus:border-accent focus:ring-2 focus:ring-accent/25 focus:outline-none disabled:opacity-60',
                        open ? 'border-accent' : 'border-line hover:border-muted/50',
                    )}
                >
                    <span className={cx('min-w-0 flex-1 truncate font-mono', !value && 'font-sans text-muted')}>{value || 'Pick a picture'}</span>
                    {value && images && !current && <span className="shrink-0 rounded bg-warn-soft px-1.5 text-[11px] font-medium text-warn">not on the server</span>}
                    <ChevronDown className={cx('size-4 shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden />
                </button>
                {value && !disabled && (
                    <button type="button" onClick={() => onChange('')} aria-label="No picture here" title="No picture here" className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
                        <X className="size-3.5" />
                    </button>
                )}
            </div>

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
                            placeholder={images ? `Find among ${images.length.toLocaleString()} pictures` : 'Loading the pictures…'}
                            role="combobox"
                            aria-expanded
                            aria-controls={listId}
                            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                            spellCheck={false}
                            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
                        />
                    </div>
                    <ul ref={list} id={listId} role="listbox" className="max-h-80 overflow-y-auto py-1">
                        {shown.length === 0 && <li className="px-3 py-3 text-sm text-muted">{images ? 'No picture by that name.' : 'Loading the pictures…'}</li>}
                        {shown.map((option, index) => (
                            <li key={`${option.group}:${option.value}`} role="presentation">
                                {(index === 0 || shown[index - 1]!.group !== option.group) && (
                                    <div className="px-3 pt-2 pb-1 font-mono text-[10.5px] font-medium tracking-[0.08em] text-muted uppercase">{option.group}</div>
                                )}
                                <div
                                    id={`${listId}-${index}`}
                                    data-index={index}
                                    role="option"
                                    aria-selected={option.value === value}
                                    onPointerEnter={() => setActive(index)}
                                    onClick={() => pick(option)}
                                    className={cx(
                                        'mx-1 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5',
                                        index === active ? 'bg-accent-soft' : option.value === value && 'bg-subtle',
                                    )}
                                >
                                    <CatalogImageThumb image={option.image} className="h-10 w-16" />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className={cx('truncate font-mono text-[13px]', index === active ? 'text-accent' : 'text-ink')}>{option.value}</span>
                                        <span className="text-[11px] text-muted">{option.image ? usedOn(option.image) : 'a name the server has no picture for'}</span>
                                    </span>
                                </div>
                            </li>
                        ))}
                        {more > 0 && <li className="px-3 py-2 text-xs text-muted">{more.toLocaleString()} more; type to narrow them down.</li>}
                    </ul>
                    {canUpload && (
                        <div className="flex items-center gap-2 border-t border-line px-3 py-2">
                            <button
                                type="button"
                                disabled={upload.isPending}
                                onClick={() => fileInput.current?.click()}
                                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-medium text-accent hover:bg-accent-soft disabled:opacity-60"
                            >
                                <Upload className="size-3.5" />
                                {upload.isPending ? 'Uploading…' : text.trim() ? `Upload as ${text.trim()}` : 'Upload a picture'}
                            </button>
                            <span className="text-[11px] text-muted">A GIF or PNG{text.trim() ? '' : ', named as its file'}.</span>
                            <input
                                ref={fileInput}
                                type="file"
                                accept="image/gif,image/png"
                                className="sr-only"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];

                                    if (file)
                                        take(file);

                                    event.target.value = '';
                                }}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
