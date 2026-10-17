import { Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { FILES, type GamedataStatus, type TextEntry, useDeleteText, useSaveText, useTextImport, useTextImportPreview, useTextSearch } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, Panel, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

import { WaitingFromHabbo } from './frame';
import { HabboDiffers, HabboUpdate, OpenRow, ReviewItem } from './parts';

/** Habbo's newest texts: what taking them in would change. */
export const HabboTexts = ({ status, defaultOpen }: { status: GamedataStatus; defaultOpen?: boolean }) => {
    const version = status.latestTexts;
    const { data: preview, error } = useTextImportPreview(version !== null);
    const take = useTextImport();

    return (
        <HabboUpdate
            defaultOpen={defaultOpen}
            title="texts"
            version={version && { name: version.hash.slice(0, 10), holds: `${version.textCount.toLocaleString()} texts`, foundAt: version.foundAt, importedAt: version.importedAt }}
            preview={preview && { ...preview, listed: preview.items.length }}
            error={error}
            file={FILES.externalTexts}
            canManage={status.canManage}
            canTake={!!preview && preview.added + preview.updated + preview.kept > 0}
            confirm={preview ? { title: 'Take in Habbo\'s texts?', body: `${preview.added} are added and ${preview.updated} updated. It runs in the background and can be rolled back from the history.` } : { title: '' }}
            onTake={() => preview && take.mutate(preview.version.id)}
            taking={take.isPending}
            takeError={take.error}
        >
            {preview?.items.map(item => (
                <ReviewItem key={item.key} action={item.action} name={item.key}>
                    <div className="flex flex-col gap-0.5 text-xs break-words">
                        {item.current !== null && <span className="text-muted">Hotel: {item.current || '""'}</span>}
                        <span className={item.action === 2 ? 'text-warn' : undefined}>Habbo: {item.incoming || '""'}</span>
                    </div>
                </ReviewItem>
            ))}
        </HabboUpdate>
    );
};

/** A text's value to change - a line break written \n, as the file has it - with Habbo's beside it. */
const TextEditor = ({ text, canManage, onDone }: { text: TextEntry | null; canManage: boolean; onDone: () => void }) => {
    const [ key, setKey ] = useState(text?.key ?? '');
    const [ value, setValue ] = useState(text?.value ?? '');
    const save = useSaveText();
    const remove = useDeleteText();
    const changed = !text || value !== text.value;

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ key: text?.key ?? key, value }, { onSuccess: onDone });
            }}
        >
            {!text && (
                <Labeled label="Key">
                    <Input value={key} onChange={event => setKey(event.target.value)} placeholder="furni_my_chair_name" className="w-full font-mono sm:max-w-96" autoFocus />
                </Labeled>
            )}
            <div className="flex flex-col gap-1">
                <Labeled label="Text" hint="A line break is written \n.">
                    <Textarea value={value} onChange={event => setValue(event.target.value)} rows={Math.min(8, Math.max(2, Math.ceil(value.length / 100)))} disabled={!canManage} />
                </Labeled>
                {text?.habbo !== null && text?.habbo !== undefined && text.habbo !== value && <HabboDiffers habbo={text.habbo || '""'} canManage={canManage} onUse={() => setValue(text.habbo!)} />}
            </div>
            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" icon={text ? <Save /> : <Plus />} disabled={!changed || save.isPending || (!text && key.trim() === '')}>{text ? 'Save' : 'Add'}</Button>
                    <Button variant="ghost" icon={<X />} onClick={onDone}>Cancel</Button>
                    {text && (
                        <Button
                            variant="ghost"
                            icon={<Trash2 />}
                            className="ml-auto text-bad hover:text-bad"
                            disabled={remove.isPending}
                            onClick={() => ask(
                                {
                                    title: `Remove the text ${text.key}?`,
                                    body: 'Habbo\'s later updates leave it removed unless Habbo changes it.',
                                    confirm: 'Remove',
                                },
                                () => remove.mutate(text.key, { onSuccess: onDone }),
                            )}
                        >
                            Remove
                        </Button>
                    )}
                </div>
            )}
            {(save.error || remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
        </form>
    );
};

/**
 * The hotel's external texts: Habbo's taken in, and the hotel's own. A text changed here stays
 * when Habbo changes it; one removed here stays removed unless Habbo changes it.
 */
export const TextsTab = ({ status }: { status: GamedataStatus }) => {
    const [ params ] = useSearchParams();
    // Opened from the search: what it found, and the one picked there open.
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<string | null>(() => params.get('open'));
    const { data: found, isFetching, error } = useTextSearch(text, page);
    const size = found?.pageSize ?? 1;

    return (
        <>
            <WaitingFromHabbo status={status} data="texts" />
            <Panel className="overflow-clip">
                <ListToolbar
                    watch={[ text, page ]}
                    page={{ offset: page * size, limit: size, total: found?.total, onChange: offset => setPage(Math.floor(offset / size)) }}
                >
                    <SearchInput
                        value={text}
                        onValueChange={(value) => {
                            setText(value);
                            setPage(0);
                        }}
                        placeholder="Key or text"
                        className="min-w-48 flex-1 sm:max-w-96"
                        aria-label="Find texts"
                    />
                    {status.canManage && <Button variant="secondary" icon={<Plus />} onClick={() => setOpen('')}>New text</Button>}
                </ListToolbar>
                {open === '' && (
                    <div className="border-b border-line bg-subtle/40 p-4">
                        <TextEditor text={null} canManage={status.canManage} onDone={() => setOpen(null)} />
                    </div>
                )}
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!found && isFetching && <Loading />}
                {found && found.items.length === 0 && <EmptyState>{text.trim() ? 'No text has those words.' : 'No texts yet: take Habbo’s in above.'}</EmptyState>}
                {found && found.items.length > 0 && (
                    <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-60')}>
                        {found.items.map(item => (
                            <OpenRow
                                key={item.key}
                                open={open === item.key}
                                onToggle={() => setOpen(open === item.key ? null : item.key)}
                                summary={(
                                    <div className="grid items-center gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(12rem,22rem)_1fr_7rem]">
                                        <span className="truncate font-mono text-[13px]">{item.key}</span>
                                        <span className="truncate text-muted">{item.value || '""'}</span>
                                        <span className="max-sm:hidden sm:justify-self-end">
                                            {item.habbo === null && <Badge tone="green">hotel's own</Badge>}
                                            {item.habbo !== null && item.habbo !== item.value && <Badge tone="amber">changed</Badge>}
                                        </span>
                                    </div>
                                )}
                            >
                                <TextEditor key={item.value} text={item} canManage={status.canManage} onDone={() => setOpen(null)} />
                            </OpenRow>
                        ))}
                    </ul>
                )}
            </Panel>
        </>
    );
};
