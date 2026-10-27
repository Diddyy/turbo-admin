import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { type TextEntry, useSaveText, useTextSearch } from '#/api/gamedata';
import { type TemplateIndex, useTemplateIndex, type WindowElement, windowOf } from '#/api/windows';
import { useSaved } from '#/components/SaveFeedback';
import { SearchInput } from '#/components/SearchInput';
import { toastError } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel } from '#/components/ui';
import { useDebounced } from '#/lib/debounce';
import { usePathTab } from '#/lib/tabs';

const TABS = [
    { value: 'windows', label: 'By window', to: '/appearance/texts/windows' },
    { value: 'shown', label: 'By shown text', to: '/appearance/texts/shown' },
];

const LIST_LIMIT = 60;

/** Every element of a tree, depth first. */
const flat = (elements: readonly WindowElement[]): WindowElement[] => elements.flatMap(element => [ element, ...flat(element.children ?? []) ]);

/** The text keys each window shows, by window id: what its captions and variables name. */
const textsByWindow = (index: TemplateIndex) => new Map(Object.entries(index.templates).map(([ id, window ]) => [ id, [ ...new Set(flat(window.elements).flatMap(element => element.texts ?? [])) ] ]));

/** One text: its key, what players see now (Habbo's beside it when the hotel changed it), edited in place. */
const TextRow = ({ entry, textKey, where }: { entry: TextEntry | undefined; textKey: string; where?: string[] }) => {
    const [ value, setValue ] = useState<string | null>(null);
    const save = useSaveText();
    const saved = useSaved();
    const shown = value ?? entry?.value ?? '';
    const dirty = value !== null && value !== (entry?.value ?? '');

    return (
        <li className="flex flex-col gap-1.5 px-4 py-2.5" data-text={textKey}>
            <div className="flex flex-wrap items-center gap-2">
                <code className="font-mono text-xs">{textKey}</code>
                {entry?.habbo !== null && entry?.habbo !== undefined && entry.habbo !== entry.value && <span className="text-xs text-muted">{`Habbo's: ${entry.habbo}`}</span>}
                {where && where.length > 0 && (
                    <span className="flex flex-wrap gap-x-2 text-xs">
                        <span className="text-muted">Shown in</span>
                        {where.slice(0, 4).map(id => <Link key={id} to={`/appearance/studio?${new URLSearchParams({ window: id })}`} className="font-mono text-accent hover:underline">{id}</Link>)}
                        {where.length > 4 && <span className="text-muted">{`and ${where.length - 4} more`}</span>}
                    </span>
                )}
            </div>
            <form
                className="flex gap-2"
                onSubmit={(event) => {
                    event.preventDefault();

                    if (dirty) save.mutate({ key: textKey, value: shown }, { onSuccess: () => {
                        setValue(null);
                        saved(`The text ${textKey}`);
                    }, onError: toastError });
                }}
            >
                <Input aria-label={textKey} value={shown} placeholder={entry ? '' : 'No text yet: the client shows the key'} onChange={event => setValue(event.target.value)} className="flex-1" />
                <Button type="submit" icon={<Save />} disabled={!dirty || save.isPending}>Save</Button>
            </form>
        </li>
    );
};

/** A text found by its key: the search answers every key or text holding the words, so the exact key is picked out. */
const KeyedRow = ({ textKey }: { textKey: string }) => {
    const { data } = useTextSearch(textKey, 0);

    return <TextRow textKey={textKey} entry={data?.items.find(item => item.key === textKey)} />;
};

/** Pick a window (by its id, its name, or a text key it shows) and edit every text it shows. */
const ByWindow = ({ index }: { index: TemplateIndex }) => {
    const [ params, setParams ] = useSearchParams();
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const words = useDebounced(text).trim().toLowerCase();
    const id = params.get('id');
    const texts = useMemo(() => textsByWindow(index), [ index ]);
    const found = [ ...texts ].filter(([ each, keys ]) => keys.length > 0 && (!words || each.toLowerCase().includes(words) || keys.some(key => key.toLowerCase().includes(words)))).map(([ each ]) => each).sort();
    const keys = id ? texts.get(id) ?? [] : [];

    return (
        <div className="grid gap-4 lg:grid-cols-[22rem_1fr]">
            <Panel title="Windows" description={`${found.length} window(s) showing texts`}>
                <div className="p-3"><SearchInput value={text} onValueChange={setText} placeholder="Find a window by its id or a text key" /></div>
                <ul className="max-h-[60vh] overflow-y-auto">
                    {found.slice(0, LIST_LIMIT).map(each => (
                        <li key={each}>
                            <button type="button" className={`w-full truncate px-4 py-1.5 text-left font-mono text-xs hover:bg-subtle ${each === id ? 'bg-subtle text-accent' : ''}`} onClick={() => setParams({ ...(text ? { q: text } : {}), id: each }, { replace: true })}>{each}</button>
                        </li>
                    ))}
                </ul>
            </Panel>
            {id
                ? (
                        <Panel title={id} description={`${windowOf(index, id)?.name ?? ''}: ${keys.length} text(s) it shows. A change is the hotel's own text, over Habbo's.`}>
                            <ul className="divide-y divide-line">{keys.map(key => <KeyedRow key={key} textKey={key} />)}</ul>
                        </Panel>
                    )
                : <EmptyState framed>Pick a window to see and edit every text it shows.</EmptyState>}
        </div>
    );
};

/** Find a text by what players see (or its key), with the windows that show it. */
const ByShown = ({ index }: { index: TemplateIndex }) => {
    const [ params, setParams ] = useSearchParams();
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const words = useDebounced(text).trim();
    const { data, error } = useTextSearch(words.length >= 2 ? words : '', 0);
    const where = useMemo(() => {
        const found = new Map<string, string[]>();

        for (const [ id, keys ] of textsByWindow(index)) for (const key of keys) found.set(key, [ ...(found.get(key) ?? []), id ]);

        return found;
    }, [ index ]);

    return (
        <Panel title="Texts" description="Type what a window shows (Earnings, Help, Catalogue) to find its key; the windows showing it are beside it.">
            <div className="p-3">
                <SearchInput
                    value={text}
                    onValueChange={(next) => {
                        setText(next);
                        setParams(next ? { q: next } : {}, { replace: true });
                    }}
                    placeholder="What the text says, or its key"
                />
            </div>
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {words.length >= 2 && !data && !error && <Loading />}
            {data && words.length >= 2 && data.items.length === 0 && <EmptyState>No text says that.</EmptyState>}
            {words.length >= 2 && (
                <ul className="divide-y divide-line">
                    {/* The texts a window shows first: those are the ones a designer means. */}
                    {[ ...(data?.items ?? []) ].sort((a, b) => Number(where.has(b.key)) - Number(where.has(a.key))).map(entry => <TextRow key={entry.key} textKey={entry.key} entry={entry} where={where.get(entry.key)} />)}
                </ul>
            )}
        </Panel>
    );
};

/** The texts windows show, found by the window or by what players see, edited in place. */
export const AppearanceTextsPage = () => {
    const [ tab, toTab ] = usePathTab(TABS.map(x => x.value));
    const { data: index, error } = useTemplateIndex();

    if (toTab) return toTab;

    return (
        <>
            <PageHeader title="Texts" description="Every text a window shows, by window or by what it says. Players see a change at their next load." tabs={{ items: TABS, value: tab }}>
                <Link to="/gamedata/texts" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-subtle">All texts</Link>
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {error && <ErrorNotice error={error} />}
                {!index && !error && <Loading />}
                {index && (tab === 'windows' ? <ByWindow index={index} /> : <ByShown index={index} />)}
            </PageBody>
        </>
    );
};
