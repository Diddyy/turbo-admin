import { ChevronDown, Square } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { type AssetJob, useCancelJob } from '#/api/bundles';
import { type PluginJob, useCancelPluginJob } from '#/api/plugins';
import { ask } from '#/components/confirm';
import { toastError } from '#/components/toast';
import { Badge, type BadgeTone, Button, ErrorNotice, Panel } from '#/components/ui';
import { cx } from '#/lib/cx';
import { fromNow } from '#/lib/time';

import { formatTime } from './format';

const STATUS_TONES: Record<AssetJob['status'], BadgeTone> = { running: 'accent', done: 'green', failed: 'red', canceled: 'amber' };

/** What a job came to, in a line. */
const Result = ({ result }: { result: string | null }) =>
    result ? <p className="text-sm">{result}</p> : null;

/**
 * The job's log in the mono face, newest at the bottom. While the job runs it follows the newest
 * line, unless the reader has scrolled up to read an older one.
 */
const JobLog = ({ log, running }: { log: string[]; running: boolean }) => {
    const box = useRef<HTMLPreElement>(null);
    const following = useRef(true);

    useEffect(() => {
        const element = box.current;

        if (element && running && following.current)
            element.scrollTop = element.scrollHeight;
    }, [ log, running ]);

    return (
        <pre
            ref={box}
            onScroll={(event) => {
                const element = event.currentTarget;

                following.current = element.scrollHeight - element.scrollTop - element.clientHeight < 24;
            }}
            className="max-h-72 overflow-auto rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[11.5px] leading-5 whitespace-pre-wrap text-muted"
        >
            {log.length > 0 ? log.join('\n') : 'Nothing logged yet.'}
        </pre>
    );
};

/**
 * A sync, a publish, or a plugin check or update: how far it has got, what it is doing now, and
 * its log; once it has ended, how. Staff who manage the assets (or the plugins) can stop one that
 * runs. `compact` keeps the log folded, for the tabs that show the job above their own content.
 */
const KIND_NAMES: Record<AssetJob['kind'] | PluginJob['kind'], string> = {
    sync: 'Sync from Habbo',
    publish: 'Publish',
    'client-build': 'Build from the client',
    'plugin-check': 'Plugin check',
    'plugin-update': 'Plugin update',
};

export const JobPanel = ({ job, canManage, compact = false, actions }: { job: AssetJob | PluginJob; canManage: boolean; compact?: boolean; actions?: ReactNode }) => {
    const running = job.status === 'running';
    const [ logOpen, setLogOpen ] = useState(!compact && running);
    const assetCancel = useCancelJob();
    const pluginCancel = useCancelPluginJob();
    const cancel = job.kind.startsWith('plugin-') ? pluginCancel : assetCancel;
    const share = job.total > 0 ? Math.min(1, job.done / job.total) : running ? 0 : 1;
    const when = running ? `started ${fromNow(job.startedAt)}` : job.finishedAt ? `ended ${fromNow(job.finishedAt)}` : `started ${fromNow(job.startedAt)}`;

    return (
        <Panel
            title={(
                <span className="flex items-center gap-2">
                    {job.title}
                    <Badge tone={STATUS_TONES[job.status]}>
                        {running && <span className="size-1.5 animate-pulse rounded-full bg-accent" aria-hidden />}
                        {job.status}
                    </Badge>
                </span>
            )}
            description={<span title={formatTime(job.finishedAt ?? job.startedAt)}>{job.title === KIND_NAMES[job.kind] ? when.charAt(0).toUpperCase() + when.slice(1) : `${KIND_NAMES[job.kind]}, ${when}`}</span>}
            actions={(
                <>
                    {actions}
                    {running && canManage && (
                        <Button
                            variant="danger"
                            icon={<Square />}
                            disabled={cancel.isPending}
                            onClick={() => ask(`Stop the ${KIND_NAMES[job.kind].toLowerCase()}? What it has done so far is kept; the next one picks up from there.`, () => cancel.mutate(undefined, { onError: toastError }))}
                        >
                            Stop
                        </Button>
                    )}
                </>
            )}
        >
            <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                    <span className="min-w-0 truncate font-medium">{job.phase || (running ? 'Starting' : 'Finished')}</span>
                    <span className="font-mono text-xs text-muted tabular-nums">
                        {job.total > 0 && `${job.done.toLocaleString()} / ${job.total.toLocaleString()}`}
                        {job.total > 0 && ` (${Math.round(share * 100)}%)`}
                        {job.failed > 0 && <span className="text-bad">{`, ${job.failed.toLocaleString()} failed`}</span>}
                    </span>
                </div>
                <div
                    role="progressbar"
                    aria-label={`${job.title} progress`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(share * 100)}
                    className="h-2 overflow-hidden rounded-full bg-line"
                >
                    <div
                        className={cx('h-2 rounded-full transition-[width] duration-700', job.status === 'failed' ? 'bg-bad' : job.status === 'canceled' ? 'bg-warn' : job.status === 'done' ? 'bg-good' : 'bg-accent')}
                        style={{ width: `${Math.round(share * 100)}%` }}
                    />
                </div>
                {job.error && <ErrorNotice error={new Error(job.error)} />}
                {!running && <Result result={job.result} />}
                <div>
                    <button
                        type="button"
                        aria-expanded={logOpen}
                        onClick={() => setLogOpen(open => !open)}
                        className="-mx-1 inline-flex min-h-9 items-center gap-1.5 rounded-md px-1 text-xs font-medium text-muted hover:text-ink"
                    >
                        <ChevronDown className={cx('size-3.5 transition-transform', !logOpen && '-rotate-90')} />
                        {logOpen ? 'Hide the log' : `Show the log (${job.log.length.toLocaleString()} lines)`}
                    </button>
                    {logOpen && <div className="mt-1.5"><JobLog log={job.log} running={running} /></div>}
                </div>
            </div>
        </Panel>
    );
};
