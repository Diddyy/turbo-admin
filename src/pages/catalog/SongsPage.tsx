import { ArrowLeft, Disc3, Plus, Save, Trash2 } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useCatalogTree } from '#/api/catalog';
import { songCalls, type SongDetail, type SongInput, useSong, useSongEdit, useSongs } from '#/api/songs';
import { ask } from '#/components/confirm';
import { toast } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Field, Labeled, Loading, PageBody, PageHeader, Panel, Switch, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

import { catalogTabs } from './catalogTabs';

/** Seconds as minutes and seconds, as the jukebox shows them. */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** "3:25", "205" or "3m25s" back to seconds; null when it says none. */
const secondsOf = (text: string) => {
    const parts = text.trim().split(':');

    if (parts.length === 2)
        return Number(parts[0]) * 60 + Number(parts[1]);

    return Number(text.trim()) || null;
};

const inputOf = (song: SongDetail | null): SongInput => ({
    name: song?.name ?? '',
    author: song?.author ?? '',
    track: song?.track ?? '',
    length: song?.length ?? 0,
    official: song?.official ?? true,
    code: song?.code ?? null,
});

/** One song's fields: what it is called, who made it, its track and length, and how the catalog sells it. */
const SongEditor = ({ song, canManage, onSaved, onDeleted }: { song: SongDetail | null; canManage: boolean; onSaved: (id: number) => void; onDeleted: () => void }) => {
    const [ draft, setDraft ] = useState(() => inputOf(song));
    const [ length, setLength ] = useState(() => (song ? clock(song.length) : ''));
    const save = useSongEdit(song ? (input: SongInput) => songCalls.update(song.id, input) : songCalls.create);
    const remove = useSongEdit(songCalls.delete);
    const set = <K extends keyof SongInput>(key: K, value: SongInput[K]) => setDraft({ ...draft, [key]: value });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        save.mutate([ { ...draft, length: secondsOf(length) ?? 0 } ], {
            onSuccess: (saved) => {
                toast(song ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
                onSaved(saved.id);
            },
        });
    };

    return (
        <form onSubmit={submit} className="flex flex-col gap-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" name="song-name" value={draft.name} onChange={event => set('name', event.target.value)} required maxLength={100} disabled={!canManage} />
                <Field label="Author" name="song-author" value={draft.author} onChange={event => set('author', event.target.value)} maxLength={50} disabled={!canManage} />
                <Field
                    label="Length"
                    name="song-length"
                    value={length}
                    onChange={event => setLength(event.target.value)}
                    placeholder="3:25"
                    hint="Minutes:seconds, or seconds. It has to match the track: the jukebox moves on when it's up."
                    required
                    disabled={!canManage}
                    className="font-mono"
                />
                <Field
                    label="Catalog code"
                    name="song-code"
                    value={draft.code ?? ''}
                    onChange={event => set('code', event.target.value.trim() || null)}
                    placeholder="optional, e.g. habbo_theme"
                    hint="The catalog names a disc by product data SONG <code> (Gamedata → Products), so give it a code and that product to show its name there. It can't start with a digit; the disc itself carries the song's number."
                    maxLength={50}
                    spellCheck={false}
                    disabled={!canManage}
                    className="font-mono"
                />
            </div>
            <Labeled label="Track" hint="The song in the client's trax format, as the trax machine writes it (1:0,4;2:0,4;…).">
                <Textarea value={draft.track} onChange={event => set('track', event.target.value)} rows={5} required spellCheck={false} disabled={!canManage} className="font-mono text-xs" />
            </Labeled>
            <Switch label="Official" hint="An official song can be sold on song discs in the catalog; the Song discs builder offers these." checked={draft.official} onChange={value => set('official', value)} disabled={!canManage} />
            {(save.error ?? remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" icon={<Save />} disabled={save.isPending}>{song ? 'Save song' : 'Add song'}</Button>
                    {song && song.discs > 0 && (
                        <span className="ml-auto text-xs text-muted">{song.discs} disc{song.discs === 1 ? ' carries' : 's carry'} it, so it can't be deleted.</span>
                    )}
                    {song && (
                        <Button
                            variant="ghost"
                            icon={<Trash2 />}
                            className={cx('text-bad hover:text-bad', song.discs === 0 && 'ml-auto')}
                            disabled={remove.isPending || song.discs > 0}
                            onClick={() => ask({ title: `Delete ${song.name}?`, confirm: 'Delete' }, () => remove.mutate([ song.id ], {
                                onSuccess: () => {
                                    toast(`Deleted ${song.name}.`);
                                    onDeleted();
                                },
                            }))}
                        >
                            Delete
                        </Button>
                    )}
                </div>
            )}
        </form>
    );
};

/**
 * The hotel's trax songs, which jukeboxes play off song discs: the list, and one to add or change.
 * Official songs are sold on discs from the catalog (a song disc is the song_disk furni carrying
 * the song's number); the Song discs builder makes a soundmachine page of them. Below the wide
 * layout the list and the song take turns: picking one shows it alone, with a way back.
 */
export const SongsPage = () => {
    const [ params, setParams ] = useSearchParams();
    const opened = params.get('song');
    const selected = opened === 'new' ? 'new' : Number(opened) || null;
    const songs = useSongs();
    const song = useSong(typeof selected === 'number' ? selected : null);
    const canManage = useCatalogTree().data?.canManage ?? false;

    const editor = useRef<HTMLDivElement>(null);

    const open = (id: number | 'new' | null) => setParams(id === null ? {} : { song: String(id) });

    // The page scrolls inside the shell: a song picked far down the list is brought to its top.
    useEffect(() => {
        if (selected !== null && !window.matchMedia('(min-width: 64rem)').matches)
            editor.current?.scrollIntoView({ block: 'start' });
    }, [ selected ]);

    return (
        <>
            <PageHeader title="Catalog" tabs={catalogTabs('songs')} description={songs.data ? `${songs.data.songs.length} songs · ${songs.data.songs.filter(x => x.official).length} official` : 'What jukeboxes play'}>
                {canManage && <Button icon={<Plus />} onClick={() => open('new')}>New song</Button>}
            </PageHeader>
            <PageBody className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <Panel title="Songs" className={cx(selected !== null && 'max-lg:hidden')}>
                    {songs.error && <div className="p-4"><ErrorNotice error={songs.error} /></div>}
                    {songs.isPending && <Loading />}
                    {songs.data && (songs.data.songs.length === 0
                        ? <EmptyState>No songs yet. Add one, then sell it on song discs with the Song discs builder on a soundmachine page.</EmptyState>
                        : (
                                <ul className="divide-y divide-line">
                                    {songs.data.songs.map(x => (
                                        <li key={x.id}>
                                            <button type="button" onClick={() => open(x.id)} className={cx('flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-subtle', selected === x.id && 'bg-accent-soft')}>
                                                <Disc3 className={cx('size-5 shrink-0', x.official ? 'text-accent' : 'text-muted')} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate text-sm">{x.name}</span>
                                                    <span className="block truncate text-xs text-muted">{x.author || 'unknown'}{x.code ? ` · ${x.code}` : ''}</span>
                                                </span>
                                                {x.discs > 0 && <Badge>{x.discs} disc{x.discs === 1 ? '' : 's'}</Badge>}
                                                {x.official && <Badge tone="accent">official</Badge>}
                                                <span className="font-mono text-xs text-muted">{clock(x.length)}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ))}
                </Panel>
                {selected !== null && (
                    <div ref={editor} className="min-w-0 scroll-mt-4">
                        <Panel
                            title={selected === 'new' ? 'New song' : song.data?.name ?? 'Song'}
                            description={selected !== 'new' && song.data ? `#${song.data.id}` : undefined}
                            actions={<Button variant="ghost" icon={<ArrowLeft />} onClick={() => open(null)} className="lg:hidden">All songs</Button>}
                        >
                            {selected === 'new' && <SongEditor key="new" song={null} canManage={canManage} onSaved={open} onDeleted={() => open(null)} />}
                            {typeof selected === 'number' && song.isPending && <Loading />}
                            {typeof selected === 'number' && song.error && <div className="p-4"><ErrorNotice error={song.error} /></div>}
                            {typeof selected === 'number' && song.data && <SongEditor key={JSON.stringify(song.data)} song={song.data} canManage={canManage} onSaved={open} onDeleted={() => open(null)} />}
                        </Panel>
                    </div>
                )}
                {selected === null && songs.data && songs.data.songs.length > 0 && (
                    <Panel className="max-lg:hidden"><EmptyState>Pick a song, or <Link to="/catalog" className="text-accent hover:underline">go back to the catalog</Link>.</EmptyState></Panel>
                )}
            </PageBody>
        </>
    );
};
