import { Plus, X } from 'lucide-react';
import { type FormEvent, useState } from 'react';

import { useAddFilterWords, useRemoveFilterWord, useTestWordFilter, useWordFilter, type WordFilterAddResponse } from '#/api/wordFilter';
import { ask } from '#/components/confirm';
import { SearchInput } from '#/components/SearchInput';
import { toast, toastError } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel, Textarea, WarningNotice } from '#/components/ui';
import { useHubTabs } from '#/layout/nav';
import { plural } from '#/lib/plural';

/** What an add did, in a line or two: added, already there, refused and why. */
const AddResult = ({ result }: { result: WordFilterAddResponse }) => (
    <div className="flex flex-col gap-1 text-[13px]">
        {result.added.length > 0 && <p>Added {result.added.join(', ')}.</p>}
        {result.existing.length > 0 && <p className="text-muted">Already on the filter: {result.existing.join(', ')}.</p>}
        {result.refused.length > 0 && (
            <WarningNotice>
                {result.refused.map(x => <span key={x.word} className="block"><b className="font-mono">{x.word}</b>: {x.reason}.</span>)}
            </WarningNotice>
        )}
    </div>
);

/** A line typed through the filter, as players would see it. */
const TryIt = () => {
    const [ text, setText ] = useState('');
    const test = useTestWordFilter();

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();

        if (text.trim())
            test.mutate(text);
    };

    return (
        <Panel title="Try a line" description="What players see when they type it, with the list as it is now.">
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-4">
                <div className="flex gap-2">
                    <Input value={text} onChange={event => setText(event.target.value)} placeholder="Type what a player might say" aria-label="A line to try" className="min-w-0 flex-1" />
                    <Button type="submit" variant="secondary" disabled={!text.trim() || test.isPending}>Try</Button>
                </div>
                {test.error && <ErrorNotice error={test.error} />}
                {test.data && (
                    <p className="rounded-lg bg-canvas px-3 py-2 text-sm wrap-anywhere">
                        {test.data.shown}
                        <span className="ml-2 text-xs text-muted">{test.data.filtered ? 'filtered' : 'nothing filtered'}</span>
                    </p>
                )}
            </form>
        </Panel>
    );
};

/**
 * The hotel's word filter: the words kept out of everything players type, chat, messages and
 * names alike, each matched whole and ignoring case. Staff who may change it add words (several
 * at once) and take them off; the hotel filters by the new list at once.
 */
export const WordFilterPage = () => {
    const tabs = useHubTabs('moderation');
    const filter = useWordFilter();
    const add = useAddFilterWords();
    const removeWord = useRemoveFilterWord();
    const [ draft, setDraft ] = useState('');
    const [ search, setSearch ] = useState('');
    const [ result, setResult ] = useState<WordFilterAddResponse | null>(null);
    const data = filter.data;
    const shown = (data?.words ?? []).filter(x => x.word.includes(search.trim().toLowerCase()));

    const handleAdd = (event: FormEvent) => {
        event.preventDefault();

        if (!draft.trim())
            return;

        add.mutate(draft, {
            onSuccess: (done) => {
                setResult(done);

                if (done.refused.length === 0)
                    setDraft('');

                if (done.added.length > 0)
                    toast(`Added ${plural(done.added.length, 'word')}`);
            },
            onError: toastError,
        });
    };

    return (
        <>
            <PageHeader
                title="Moderation"
                tabs={tabs}
                description={data ? `${plural(data.words.length, 'word')} filtered, each shown as “${data.replacement}”` : 'The words kept out of what players type'}
            />
            <PageBody>
                {filter.error && <ErrorNotice error={filter.error} />}
                {filter.isPending && <Loading />}
                {data && (
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
                        <Panel className="overflow-clip" title="Words" description="Matched whole and ignoring case, in everything players type that others see.">
                            <div className="border-b border-line px-4 py-3">
                                <SearchInput value={search} onValueChange={setSearch} placeholder="Find a word" aria-label="Find a word" className="sm:max-w-64" />
                            </div>
                            {shown.length === 0
                                ? <EmptyState>{data.words.length === 0 ? 'The filter has no words yet.' : 'No word matches.'}</EmptyState>
                                : (
                                        <ul className="flex flex-wrap gap-1.5 p-4">
                                            {shown.map(entry => (
                                                <li key={entry.id} className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-canvas pr-1 pl-2.5 font-mono text-[13px]">
                                                    {entry.word}
                                                    {data.canManage && (
                                                        <button
                                                            type="button"
                                                            aria-label={`Take ${entry.word} off the filter`}
                                                            disabled={removeWord.isPending}
                                                            onClick={() => ask(`Take “${entry.word}” off the filter? Players can say it again at once.`, () => removeWord.mutate(entry.id, { onSuccess: () => toast(`Took ${entry.word} off`), onError: toastError }))}
                                                            className="grid size-6 place-items-center rounded text-muted hover:bg-subtle hover:text-bad"
                                                        >
                                                            <X className="size-3.5" />
                                                        </button>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                        </Panel>

                        <div className="flex min-w-0 flex-col gap-4">
                            {data.canManage && (
                                <Panel title="Add words" description="Several at once, with spaces, commas or new lines between them. Letters and digits only.">
                                    <form onSubmit={handleAdd} className="flex flex-col gap-3 p-4">
                                        <Textarea rows={3} value={draft} onChange={event => setDraft(event.target.value)} placeholder="heck, darn" aria-label="Words to add" />
                                        <Button type="submit" icon={<Plus />} disabled={!draft.trim() || add.isPending} className="self-start">Add</Button>
                                        {result && <AddResult result={result} />}
                                    </form>
                                </Panel>
                            )}
                            <TryIt />
                        </div>
                    </div>
                )}
            </PageBody>
        </>
    );
};
