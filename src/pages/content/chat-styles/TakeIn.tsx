import { CheckCircle2, FileUp, Loader2, MonitorDown } from 'lucide-react';
import { type DragEvent, useRef, useState } from 'react';

import { type ChatStyleImportResult, useChatStyles, useImportChatStyles } from '#/api/content';
import { Modal } from '#/components/Modal';
import { Button, Checkbox, ErrorNotice } from '#/components/ui';
import { cx } from '#/lib/cx';

interface Attempt {
    id: number;
    /** What was taken in: a file's name, or Habbo's client. */
    what: string;
    state: 'running' | 'done' | 'failed';
    result?: ChatStyleImportResult;
    error?: unknown;
}

const Outcome = ({ attempt }: { attempt: Attempt }) => {
    if (attempt.state === 'running')
        return <span className="inline-flex items-center gap-1.5 text-xs text-muted"><Loader2 className="size-3.5 animate-spin" /> Taking it in</span>;

    if (attempt.state === 'failed')
        return <div className="text-xs"><ErrorNotice error={attempt.error} /></div>;

    const result = attempt.result!;

    return (
        <span className="inline-flex items-center gap-1.5 text-xs text-good">
            <CheckCircle2 className="size-3.5" />
            {`Took in ${result.added + result.updated} styles: ${result.added} new, ${result.updated} changed${result.kept ? `, ${result.kept} kept as changed here` : ''}.`}
        </span>
    );
};

/**
 * Taking chat styles in, as the library's upload takes bundles: a habbo-free-flow-chat-com bundle
 * file dropped or chosen, or the chat library of the release of Habbo's HTML client the hotel
 * builds from. Each style in it gets the look it has there and one the hotel lacks is added; a
 * style changed here since it was taken from the client is kept, unless the viewer says to replace
 * it too. Each one taken in is listed with how it went; the dialog stays open until they are done.
 */
export const TakeInDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const { data } = useChatStyles();
    const take = useImportChatStyles();
    const [ attempts, setAttempts ] = useState<Attempt[]>([]);
    const [ over, setOver ] = useState(false);
    const [ replace, setReplace ] = useState(false);
    const next = useRef(1);
    const changedHere = (data?.items ?? []).filter(x => x.changedHere).length;
    const running = attempts.some(x => x.state === 'running');

    const set = (id: number, change: Partial<Attempt>) => setAttempts(current => current.map(x => (x.id === id ? { ...x, ...change } : x)));

    const run = async (source: File | 'client') => {
        const id = next.current++;

        setAttempts(current => [ ...current, { id, what: source === 'client' ? 'Habbo\'s client' : source.name, state: 'running' } ]);

        try {
            set(id, { state: 'done', result: await take.mutateAsync(source === 'client' && replace && changedHere > 0 ? 'client-replace' : source) });
        } catch (error) {
            set(id, { state: 'failed', error });
        }
    };

    const add = (files: FileList | null) => {
        const file = files?.[0];

        if (file && !running)
            void run(file);
    };

    const drop = (event: DragEvent) => {
        event.preventDefault();
        setOver(false);
        add(event.dataTransfer.files);
    };

    const close = () => {
        if (running)
            return;

        setAttempts([]);
        setReplace(false);
        onClose();
    };

    return (
        <Modal open={open} onClose={close} title="Take in chat styles" className="sm:h-fit! sm:max-w-2xl">
            <div className="flex flex-col gap-4 p-4 sm:p-5">
                <p className="text-sm text-muted">Each style taken in gets the look it has there, and one the hotel lacks is added. Who may speak with the hotel's own stays as it is set here.</p>
                <label
                    onDragOver={(event) => {
                        event.preventDefault();
                        setOver(true);
                    }}
                    onDragLeave={() => setOver(false)}
                    onDrop={drop}
                    className={cx(
                        'flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-accent',
                        running ? 'pointer-events-none opacity-60' : 'cursor-pointer',
                        over ? 'border-accent bg-accent-soft' : 'border-line bg-canvas hover:border-accent',
                    )}
                >
                    <FileUp className="size-7 text-muted" aria-hidden />
                    <span className="text-sm font-medium">Drop a bundle file here, or choose it</span>
                    <span className="max-w-md text-xs text-muted">A habbo-free-flow-chat-com .nitro: another hotel's, or one built elsewhere.</span>
                    <input
                        type="file"
                        accept=".nitro"
                        className="sr-only"
                        disabled={running}
                        onChange={(event) => {
                            add(event.target.files);
                            event.target.value = '';
                        }}
                    />
                </label>
                <div className="flex items-center gap-3 font-mono text-[11px] tracking-[0.08em] text-muted uppercase" aria-hidden>
                    <span className="h-px flex-1 bg-line" />
                    or
                    <span className="h-px flex-1 bg-line" />
                </div>
                <div className="flex flex-col gap-3 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
                    <MonitorDown className="size-7 shrink-0 text-muted max-sm:hidden" aria-hidden />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <div>
                            <div className="text-sm font-medium">Habbo's chat styles</div>
                            <div className="text-xs text-muted">The chat library of the release of Habbo's HTML client the hotel builds from.</div>
                        </div>
                        {changedHere > 0 && (
                            <Checkbox
                                label={`Replace the ${changedHere} ${changedHere === 1 ? 'style' : 'styles'} changed here too`}
                                hint="They were changed here since they were taken from Habbo's client. Left off, they are kept as they are."
                                checked={replace}
                                disabled={running}
                                onChange={setReplace}
                            />
                        )}
                    </div>
                    <Button icon={<MonitorDown />} disabled={running} onClick={() => void run('client')} className="self-start sm:self-center">Take in Habbo's</Button>
                </div>
                {attempts.length > 0 && (
                    <ul className="divide-y divide-line rounded-xl border border-line">
                        {attempts.map(attempt => (
                            <li key={attempt.id} className="flex flex-col gap-1.5 px-3 py-2.5">
                                <span className="min-w-0 truncate font-mono text-[13px]" title={attempt.what}>{attempt.what}</span>
                                <Outcome attempt={attempt} />
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex justify-end">
                    <Button variant={running ? 'ghost' : 'secondary'} disabled={running} onClick={close}>{running ? 'Taking in' : 'Done'}</Button>
                </div>
            </div>
        </Modal>
    );
};
