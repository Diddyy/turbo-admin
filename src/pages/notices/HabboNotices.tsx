import { CloudDownload } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useHabboNotices, useHabboNoticeTexts } from '#/api/notices';
import { Modal } from '#/components/Modal';
import { Badge, Button, Checkbox, EmptyState, ErrorNotice, Loading } from '#/components/ui';
import { fromNow } from '#/lib/time';

import { descKey, type NoticeSet, parseNotices } from './model';
import { NoticePreview } from './NoticePreview';

/**
 * Habbo's notices as its external variables have them now, read from Habbo when opened, with their
 * words from the newest of Habbo's texts the hotel has found. Taking them puts Habbo's set among the
 * page's changes - its shown ones, in its order, and every notice it keeps - to look at and save as
 * any edit. The hotel's own notices Habbo has none of stay, not shown, unless asked to go.
 */
export const HabboNotices = ({ open, onClose, current, onTake }: { open: boolean; onClose: () => void; current: NoticeSet; onTake: (set: NoticeSet) => void }) => {
    const { data: preview, error, isFetching } = useHabboNotices(open);
    const [ removeOwn, setRemoveOwn ] = useState(false);
    const habbo = useMemo(() => parseNotices(Object.fromEntries((preview?.variables ?? []).map(x => [ x.key, x.value ])), {}), [ preview ]);
    const textKeys = useMemo(() => habbo.notices.map(x => descKey(x.key)), [ habbo ]);
    const { data: texts, error: textsError } = useHabboNoticeTexts(textKeys, open && !!preview);
    const words = useMemo(() => new Map((texts?.texts ?? []).map(x => [ x.key, x.value ])), [ texts ]);
    const theirs = useMemo(() => habbo.notices.map(x => ({ ...x, desc: words.get(descKey(x.key)) ?? current.notices.find(y => y.key === x.key)?.desc ?? '' })), [ habbo, words, current ]);
    const own = current.notices.filter(x => !habbo.notices.some(y => y.key === x.key));

    const take = () => {
        onTake({ active: habbo.active, notices: [ ...theirs, ...(removeOwn ? [] : own) ] });
        onClose();
    };

    return (
        <Modal open={open} onClose={onClose} title={preview ? `Habbo's notices, from habbo.${preview.domain}` : 'Habbo\'s notices'} className="sm:h-fit! sm:max-w-3xl">
            {error && <div className="p-5"><ErrorNotice error={error} /></div>}
            {!preview && !error && <Loading />}
            {preview && (
                <div className="flex flex-col">
                    <p className="px-4 py-3 text-[13px] text-muted sm:px-5">
                        What Habbo shows now, in its order. Taking it puts it among your changes: look at it, then save it, or discard it.
                    </p>
                    <div className="max-h-[55dvh] overflow-y-auto border-y border-line">
                        {theirs.length === 0 && <EmptyState>Habbo has no notices.</EmptyState>}
                        <ul className="divide-y divide-line">
                            {theirs.map(notice => (
                                <li key={notice.key} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                                    <NoticePreview notice={notice} missingText={!notice.desc} />
                                    <span className="flex min-w-0 flex-col gap-1">
                                        <span className="font-mono text-xs">{notice.key}</span>
                                        <span className="flex flex-wrap gap-1">
                                            {habbo.active.includes(notice.key)
                                                ? <Badge tone="green">shown #{habbo.active.indexOf(notice.key) + 1}</Badge>
                                                : <Badge>not shown</Badge>}
                                            {!current.notices.some(x => x.key === notice.key) && <Badge tone="accent">new</Badge>}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {textsError && <div className="px-4 pt-3 sm:px-5"><ErrorNotice error={textsError} /></div>}
                    <div className="flex flex-col gap-3 px-4 py-3 sm:px-5">
                        <p className="text-xs text-muted">
                            {texts?.checkedAt
                                ? `Words from Habbo's texts as last found, ${fromNow(texts.checkedAt)}.`
                                : texts ? 'Habbo\'s texts haven\'t been found yet: check Habbo on the Habbo updates page to bring the notices\' words too.' : 'Reading Habbo\'s texts…'}
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
