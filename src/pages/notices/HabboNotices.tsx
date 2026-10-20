import { CloudDownload, Download } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ask } from '#/components/confirm';
import { Modal } from '#/components/Modal';
import { Badge, Button, Checkbox, EmptyState, ErrorNotice, Loading } from '#/components/ui';
import { fromNow } from '#/lib/time';

import { useHabboSet } from './hooks';
import { habboStatus, type Notice, type NoticeSet, takeHabbos } from './model';
import { NoticePreview } from './NoticePreview';

/**
 * Habbo's set to take whole - its shown ones in its order and every notice it keeps - or one notice
 * at a time. Either goes among the page's unsaved changes, never straight to the hotel; one with
 * unsaved changes of its own is asked about first. The hotel's own notices Habbo has none of stay,
 * not shown, unless asked to go.
 */
export const HabboNotices = ({ open, onClose, current, dirty, onTake, onTakeOne }: {
    open: boolean;
    onClose: () => void;
    current: NoticeSet;
    dirty: (key: string) => boolean;
    onTake: (set: NoticeSet) => void;
    onTakeOne: (habbo: Notice, wordsKnown: boolean) => void;
}) => {
    const { habbo, domain, wordsKnown, checkedAt, textsLoaded, error, isFetching } = useHabboSet(open);
    const [ removeOwn, setRemoveOwn ] = useState(false);
    // Habbo's words where it has them found, else the hotel's own for that key, as before.
    const theirs = useMemo(() => (habbo?.notices ?? []).map(x => ({ ...x, texts: { ...x.texts, desc: x.texts.desc || current.notices.find(y => y.key === x.key)?.texts.desc || '' } })), [ habbo, current ]);
    const own = current.notices.filter(x => !theirs.some(y => y.key === x.key));
    const edited = current.notices.filter(x => dirty(x.key)).map(x => x.key);

    const take = () => {
        const go = () => {
            // Each keeps the hotel's own extras (when it shows, who sees it, its close and labels): Habbo has none.
            onTake({ active: habbo!.active, notices: [ ...theirs.map(x => takeHabbos(current.notices.find(y => y.key === x.key), x, true)), ...(removeOwn ? [] : own) ] });
            onClose();
        };

        if (edited.length) ask({ title: 'Replace your unsaved changes?', body: `Unsaved changes to ${edited.join(', ')} are replaced by Habbo's set.`, confirm: 'Replace them' }, go);
        else go();
    };

    const takeOne = (notice: Notice) => {
        const go = () => onTakeOne(notice, wordsKnown);

        if (dirty(notice.key)) ask({ title: `Replace your unsaved changes to ${notice.key}?`, body: 'Habbo\'s version goes in their place, still unsaved.', confirm: 'Replace them' }, go);
        else go();
    };

    return (
        <Modal open={open} onClose={onClose} title={domain ? `Habbo's notices, from habbo.${domain}` : 'Habbo\'s notices'} className="sm:h-fit! sm:max-w-3xl">
            {error && <div className="p-5"><ErrorNotice error={error} /></div>}
            {!habbo && !error && <Loading />}
            {habbo && (
                <div className="flex flex-col">
                    <p className="px-4 py-3 text-[13px] text-muted sm:px-5">
                        What Habbo shows now, in its order. Take one notice or the whole set: either goes among your unsaved changes, to look at and save, or discard.
                    </p>
                    <div className="max-h-[55dvh] overflow-y-auto border-y border-line">
                        {theirs.length === 0 && <EmptyState>Habbo has no notices.</EmptyState>}
                        <ul className="divide-y divide-line" data-testid="habbo-notices">
                            {theirs.map((notice) => {
                                const mine = current.notices.find(x => x.key === notice.key);
                                const status = mine ? habboStatus(mine, notice, wordsKnown) : null;

                                return (
                                    <li key={notice.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                                        <NoticePreview notice={notice} />
                                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                                            <span className="font-mono text-xs">{notice.key}</span>
                                            <span className="flex flex-wrap gap-1">
                                                {habbo.active.includes(notice.key)
                                                    ? <Badge tone="green">shown #{habbo.active.indexOf(notice.key) + 1}</Badge>
                                                    : <Badge>not shown</Badge>}
                                                {!mine && <Badge tone="accent">new</Badge>}
                                                {status === 'same' && <Badge>same as yours</Badge>}
                                                {status === 'differs' && <Badge tone="amber">differs from yours</Badge>}
                                                {mine && dirty(mine.key) && <Badge tone="accent">yours unsaved</Badge>}
                                            </span>
                                        </span>
                                        <Button variant="secondary" icon={<Download />} disabled={status === 'same'} onClick={() => takeOne(notice)} aria-label={`Take Habbo's ${notice.key}`}>
                                            {mine ? 'Re-sync' : 'Import'}
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                    <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
                        <p className="text-xs text-muted">
                            {checkedAt
                                ? `Words from Habbo's texts as last found, ${fromNow(checkedAt)}.`
                                : textsLoaded ? 'Habbo\'s texts haven\'t been found yet: check Habbo on the Habbo updates page to bring the notices\' words too.' : 'Reading Habbo\'s texts…'}
                        </p>
                        {own.length > 0 && (
                            <Checkbox
                                label={`Also remove your ${own.length === 1 ? 'notice' : `${own.length} notices`} Habbo has none of (${own.map(x => x.key).join(', ')})`}
                                hint="Left off, they stay, not shown."
                                checked={removeOwn}
                                onChange={setRemoveOwn}
                            />
                        )}
                        <div className="flex flex-wrap items-center justify-end gap-2">
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button icon={<CloudDownload />} disabled={isFetching || theirs.length === 0} onClick={take}>Take Habbo's set</Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};
