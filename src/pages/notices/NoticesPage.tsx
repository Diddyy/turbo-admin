import { CloudDownload, Copy, GitCompare, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useHotelView } from '#/api/hotelView';
import { type NoticeData, type NoticeSave, useNotices, useSaveNotices } from '#/api/notices';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, Input, Loading, PageBody, PageHeader, Panel, SuccessNotice, Switch, WarningNotice } from '#/components/ui';

import { HabboNotices } from './HabboNotices';
import { useHabboSet } from './hooks';
import { copyNotice, countChanges, diffActive, diffNotice, diffNotices, freeKey, habboStatus, hiddenReason, mergeSaves, newNotice, type Notice, type NoticeSet, parseNoticeData, sameNotice, takeHabbos, validKey } from './model';
import { HabboCompare, NoticeEditor } from './NoticeEditor';
import { NoticePreview } from './NoticePreview';
import { NoticeTable } from './NoticeTable';

/** Starting a new notice: its key, which its variables and texts are named by. */
const NewNotice = ({ taken, onMake }: { taken: (key: string) => boolean; onMake: (key: string) => void }) => {
    const [ key, setKey ] = useState('');
    const clean = key.trim();
    const clash = taken(clean);
    const valid = validKey(clean);

    return (
        <form
            className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3"
            onSubmit={(event) => {
                event.preventDefault();
                if (valid && !clash) onMake(clean);
            }}
        >
            <Input aria-label="New notice key" value={key} onChange={event => setKey(event.target.value)} placeholder="new_notice_key" className="w-64 font-mono" spellCheck={false} />
            <Button type="submit" icon={<Plus />} disabled={!valid || clash}>Make it</Button>
            <span className="text-xs text-muted">
                {clash ? 'A notice has that key.' : clean && !valid ? 'Letters, digits, _ and - only.' : 'Its variables are notifications.new_feature.<field>.<key>; it is shown last, and nothing is saved until you save it.'}
            </span>
        </form>
    );
};

const Notices = ({ server, canManage, save }: { server: NoticeData; canManage: boolean; save: ReturnType<typeof useSaveNotices> }) => {
    const { key: editing } = useParams();
    const navigate = useNavigate();
    const saved = useMemo(() => parseNoticeData(server), [ server ]);
    // Only what is changed is kept here, over what the server holds: a save reading the notices back keeps the rest's edits.
    // The list and a notice's own page are one route, so these stay while going between them.
    const [ drafts, setDrafts ] = useState<Record<string, Notice>>({});
    const [ activeDraft, setActiveDraft ] = useState<string[] | null>(null);
    const [ removed, setRemoved ] = useState<string[]>([]);
    const [ making, setMaking ] = useState(false);
    const [ pulling, setPulling ] = useState(false);
    const [ comparing, setComparing ] = useState(false);
    const habbo = useHabboSet(comparing || pulling);
    const disabled = !canManage;

    const open = (key: string) => void navigate(`/notices/${encodeURIComponent(key)}`);
    const toList = () => void navigate('/notices');

    const set = useMemo<NoticeSet>(() => {
        const notices = [
            ...saved.notices.filter(x => !removed.includes(x.key)).map(x => drafts[x.key] ?? x),
            ...Object.values(drafts).filter(x => !saved.notices.some(y => y.key === x.key) && !removed.includes(x.key)),
        ];

        return { notices, active: (activeDraft ?? saved.active).filter(key => notices.some(x => x.key === key)) };
    }, [ saved, drafts, activeDraft, removed ]);

    const savedOf = (key: string) => saved.notices.find(x => x.key === key);
    const dirty = (key: string) => {
        const draft = drafts[key];

        return !!draft && !sameNotice(draft, savedOf(key));
    };
    const isNew = (key: string) => !savedOf(key);
    const orderDirty = set.active.join(',') !== saved.active.join(',');
    const changes = useMemo(() => diffNotices(set, server), [ set, server ]);
    const count = countChanges(changes);

    useEffect(() => {
        if (count === 0) return;

        const warn = (event: BeforeUnloadEvent) => event.preventDefault();

        window.addEventListener('beforeunload', warn);

        return () => window.removeEventListener('beforeunload', warn);
    }, [ count ]);

    const shown = set.active.map(key => set.notices.find(x => x.key === key)).filter((x): x is Notice => !!x);
    const hidden = set.notices.filter(x => !set.active.includes(x.key));
    const habboNotice = (key: string) => habbo.habbo?.notices.find(x => x.key === key);
    const habboOf = (x: Notice) => (habbo.habbo ? habboStatus(x, habboNotice(x.key), habbo.wordsKnown) : null);

    const update = (next: Notice) => setDrafts(previous => ({ ...previous, [next.key]: next }));
    const setActive = (change: (active: string[]) => string[]) => setActiveDraft(change(set.active));
    const move = (key: string, by: number) => setActive((active) => {
        const next = [ ...active ];
        const at = next.indexOf(key);
        const to = at + by;

        if (at < 0 || to < 0 || to >= next.length) return active;

        [ next[at], next[to] ] = [ next[to]!, next[at]! ];

        return next;
    });
    const setShown = (key: string, show: boolean) => setActive(active => (show ? [ ...active.filter(x => x !== key), key ] : active.filter(x => x !== key)));

    /** The saved shown keys with only this notice shown or hidden as it is here (its place in the order saves with the order). */
    const activeFor = (key: string, keep: boolean) => {
        const next = saved.active.filter(x => x !== key);

        if (keep && set.active.includes(key)) next.splice(Math.min(set.active.indexOf(key), next.length), 0, key);

        return next;
    };
    const forget = (key: string) => setDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([ x ]) => x !== key)));
    const run = (changes: NoticeSave, done: () => void, message: string) => {
        if (countChanges(changes) === 0) return done();

        save.mutateAsync(changes).then(() => {
            done();
            toast(message);
        }, toastError);
    };

    const saveNotice = (key: string) => {
        const draft = set.notices.find(x => x.key === key)!;

        run(mergeSaves(diffNotice(key, draft, server), diffActive(activeFor(key, true), server)), () => forget(key), `Saved ${key}. Players see it when they next load the client.`);
    };
    const discardNotice = (key: string) => {
        forget(key);

        if (!savedOf(key)) {
            setActiveDraft(active => active && active.filter(x => x !== key));
            toList();
        }
    };
    const deleteNotice = (key: string) => ask({ title: `Delete ${key}?`, body: savedOf(key) ? 'Its variables and words are removed from the hotel now. The variables can be rolled back from the gamedata history.' : 'It was never saved.', confirm: 'Delete', danger: true }, () => {
        const gone = () => {
            forget(key);
            setActiveDraft(active => active && active.filter(x => x !== key));
            setRemoved(previous => previous.filter(x => x !== key));
            toList();
        };

        if (!savedOf(key)) return gone();

        run(mergeSaves(diffNotice(key, null, server), diffActive(activeFor(key, false), server)), gone, `Deleted ${key}.`);
    });
    const duplicate = (source: Notice) => {
        const key = freeKey(source.key, x => set.notices.some(y => y.key === x));

        update(copyNotice(source, key));
        open(key);
    };
    const takeHabboOne = (theirs: Notice, wordsKnown: boolean) => {
        update(takeHabbos(set.notices.find(x => x.key === theirs.key), theirs, wordsKnown));

        if (!set.notices.some(x => x.key === theirs.key) && habbo.habbo?.active.includes(theirs.key)) setActive(active => [ ...active, theirs.key ]);

        open(theirs.key);
    };
    const takeSet = (next: NoticeSet) => {
        setDrafts(Object.fromEntries(next.notices.map(x => [ x.key, x ])));
        setRemoved(saved.notices.filter(x => !next.notices.some(y => y.key === x.key)).map(x => x.key));
        setActiveDraft(next.active);
        toList();
    };
    const discardAll = () => ask({ title: 'Discard every unsaved change?', confirm: 'Discard', danger: true }, () => {
        setDrafts({});
        setActiveDraft(null);
        setRemoved([]);
    });
    const saveAll = () => run(changes, () => {
        setDrafts({});
        setActiveDraft(null);
        setRemoved([]);
    }, 'Saved. Players see it when they next load the client.');
    const saveOrder = () => run(diffActive(set.active, server), () => setActiveDraft(null), 'Saved the order.');
    const make = (key: string) => {
        update(newNotice(key));
        setActive(active => [ ...active, key ]);
        setMaking(false);
        open(key);
    };

    const compareButton = <Button variant="ghost" icon={<GitCompare />} onClick={() => setComparing(x => !x)} aria-pressed={comparing}>{comparing ? 'Hide Habbo\'s' : 'Compare with Habbo'}</Button>;
    const habboModal = <HabboNotices open={pulling} onClose={() => setPulling(false)} current={set} dirty={dirty} onTake={takeSet} onTakeOne={takeHabboOne} />;
    const notices = (
        <>
            {save.error && <ErrorNotice error={save.error} />}
            {habbo.error && comparing && <ErrorNotice error={habbo.error} />}
            {!canManage && <WarningNotice>You can look, but changing notices needs the gamedata manage permission.</WarningNotice>}
        </>
    );

    if (editing) {
        const notice = set.notices.find(x => x.key === editing) ?? null;

        if (!notice)
            return (
                <>
                    <PageHeader title={editing} back={{ to: '/notices', label: 'Notices' }} />
                    <PageBody><EmptyState framed>There is no notice {editing}. It may have been deleted, or its unsaved changes discarded.</EmptyState></PageBody>
                </>
            );

        const key = notice.key;
        const at = set.active.indexOf(key);
        const reason = hiddenReason(notice);
        const changed = dirty(key) || activeFor(key, true).join(',') !== saved.active.join(',');
        const others = set.notices.filter(x => x.key !== key && dirty(x.key)).length + removed.length;

        return (
            <>
                <PageHeader
                    title={key}
                    description={isNew(key) ? 'A new notice: nothing is made until you save it' : at >= 0 ? `Shown, #${at + 1}${reason ? ` - players don't see it now (${reason})` : ''}` : 'Not shown'}
                    back={{ to: '/notices', label: 'Notices' }}
                >
                    {compareButton}
                    {canManage && <Button variant="secondary" icon={<Copy />} onClick={() => duplicate(notice)}>Duplicate</Button>}
                    {canManage && <Button variant="danger" icon={<Trash2 />} disabled={save.isPending} onClick={() => deleteNotice(key)}>Delete</Button>}
                </PageHeader>
                {habboModal}
                <PageBody className="flex flex-col gap-4 lg:gap-5">
                    {notices}
                    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-5">
                        <Panel title="Notice" description="What it says and shows, where a click goes, how it closes, and when it shows and to whom.">
                            <NoticeEditor key={key} notice={notice} onChange={update} disabled={disabled} />
                        </Panel>
                        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:gap-5">
                            <Panel title="As docked" description="About as the client draws it under the purse. Unsaved changes show here too.">
                                <div className="flex justify-center rounded-b-xl bg-[#0e1a2b] p-6" data-testid="notice-live-preview">
                                    <NoticePreview notice={notice} />
                                </div>
                            </Panel>
                            <Panel title="In the column">
                                <div className="px-4 py-2">
                                    <Switch
                                        label="Shown"
                                        hint={at >= 0 ? `#${at + 1} of ${set.active.length}: move it on the list.` : 'Kept, not docked. Shown, it goes last.'}
                                        checked={at >= 0}
                                        disabled={disabled}
                                        onChange={show => setShown(key, show)}
                                    />
                                </div>
                            </Panel>
                            {comparing && (
                                <Panel title="Habbo's version">
                                    <div className="p-4">
                                        {habbo.habbo
                                            ? <HabboCompare notice={notice} habbo={habboNotice(key)} wordsKnown={habbo.wordsKnown} disabled={disabled} onTake={() => takeHabboOne(habboNotice(key)!, habbo.wordsKnown)} />
                                            : !habbo.error && <p className="text-xs text-muted">Reading Habbo&apos;s notices…</p>}
                                    </div>
                                </Panel>
                            )}
                        </aside>
                    </div>
                    {canManage && (changed || isNew(key)) && (
                        <div className="sticky bottom-3 z-20 rounded-xl border border-accent/40 bg-surface/95 shadow-lg backdrop-blur">
                            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                                <span className="text-sm" data-testid="notice-state">
                                    {isNew(key) ? 'A new notice, not saved' : 'Changes to this notice not saved'}
                                    <span className="text-muted max-sm:hidden"> · players see it when they next load the client</span>
                                    {others > 0 && <span className="text-muted max-sm:hidden">{` · ${others} other ${others === 1 ? 'notice' : 'notices'} unsaved on the list`}</span>}
                                </span>
                                <span className="ml-auto flex gap-2">
                                    <Button variant="ghost" icon={<RotateCcw />} disabled={save.isPending || !dirty(key)} onClick={() => discardNotice(key)}>Discard</Button>
                                    <Button icon={<Save />} disabled={save.isPending || !changed} onClick={() => saveNotice(key)}>{save.isPending ? 'Saving' : 'Save notice'}</Button>
                                </span>
                            </div>
                        </div>
                    )}
                </PageBody>
            </>
        );
    }

    const table = (list: Notice[], ordered: boolean, empty: string) => (
        <NoticeTable notices={list} ordered={ordered} empty={empty} dirty={dirty} isNew={isNew} habboOf={habboOf} disabled={disabled} onOpen={open} onMove={move} onShow={setShown} />
    );

    return (
        <>
            <PageHeader title="Notices" description="The new feature notices docked under the purse: what they say and show, where they go, when and to whom">
                {compareButton}
                {canManage && <Button variant="secondary" icon={<CloudDownload />} onClick={() => setPulling(true)}>Copy Habbo's set</Button>}
                {count > 0 && <Button variant="ghost" icon={<RotateCcw />} onClick={discardAll}>Discard all</Button>}
                {canManage && (
                    <Button variant={count > 0 ? 'primary' : 'secondary'} icon={<Save />} disabled={count === 0 || save.isPending} onClick={saveAll}>
                        {count > 0 ? `Save all (${count} ${count === 1 ? 'change' : 'changes'})` : 'All saved'}
                    </Button>
                )}
                {canManage && <Button icon={<Plus />} onClick={() => setMaking(x => !x)} aria-pressed={making}>New notice</Button>}
            </PageHeader>
            {habboModal}
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {notices}
                {save.isSuccess && count === 0 && (
                    <SuccessNotice>
                        Saved. The variables can be rolled back from <Link to="/gamedata/updates/history" className="underline">the gamedata history</Link>.
                    </SuccessNotice>
                )}
                <Panel
                    title={<span className="flex items-center gap-2">Shown{orderDirty && <Badge tone="accent">order unsaved</Badge>}</span>}
                    description="Top to bottom as the column docks them; one with an expiry or a countdown docks after the others. Open a notice to change it."
                    actions={orderDirty && canManage && <Button variant="secondary" icon={<Save />} disabled={save.isPending} onClick={saveOrder}>Save order</Button>}
                >
                    {making && <NewNotice taken={x => set.notices.some(y => y.key === x)} onMake={make} />}
                    {table(shown, true, 'None shown.')}
                </Panel>
                <Panel title="Not shown" description="Kept, ready to show again.">
                    {table(hidden, false, 'Every notice is shown.')}
                </Panel>
            </PageBody>
        </>
    );
};

/**
 * The new feature notices (Habbo's `notifications.new_feature.*`): a list of which show, in which
 * order, and a page per notice for its words, picture, look, link, closing, when it shows and to
 * whom - kept as the client's own variables and texts, saved through them a notice at a time or
 * all at once. Unsaved changes stay while going between the list and a notice.
 */
export const NoticesPage = () => {
    const { data, error } = useNotices();
    const save = useSaveNotices();
    const { data: hotelView } = useHotelView();

    if (error) return <PageBody><ErrorNotice error={error} /></PageBody>;

    if (!data) return <Loading />;

    // Changing them is changing gamedata: the hotel view's own answer says whether this staff may.
    return <Notices server={data} canManage={!!hotelView?.canManage} save={save} />;
};
