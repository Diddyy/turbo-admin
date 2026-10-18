import { useMutation } from '@tanstack/react-query';
import { FileUp, Hammer, Layers, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { catalogCalls, type CatalogTree, type ImportPageChange, type ImportPlan, type ImportRequest, useCatalogEdit } from '#/api/catalog';
import { ask } from '#/components/confirm';
import { celebrate, toast, toastError } from '#/components/toast';
import { Button, ErrorNotice, Label, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';

const ACTIONS: Record<ImportPageChange['action'], { label: string; tone: string }> = {
    add: { label: 'add', tone: 'bg-accent-soft text-accent' },
    update: { label: 'update', tone: 'bg-warn-soft text-warn' },
    unchanged: { label: 'same', tone: 'bg-subtle text-muted' },
    out: { label: 'take out', tone: 'bg-warn-soft text-warn' },
};

const PageRow = ({ page }: { page: ImportPageChange }) => {
    const action = ACTIONS[page.action];
    const depth = Math.max(0, page.path.split('/').length - 3);

    return (
        <li className="flex min-h-8 items-center gap-2 rounded-lg pr-2 text-[13px] hover:bg-subtle" style={{ paddingLeft: `${8 + depth * 18}px` }}>
            <span className={cx('w-16 shrink-0 rounded px-1.5 py-0.5 text-center font-mono text-[10px] uppercase', action.tone)}>{action.label}</span>
            <span className="min-w-0 flex-1 truncate">{page.title}<span className="ml-2 font-mono text-[11px] text-muted">{page.name}</span></span>
            {page.fields.length > 0 && <span className="font-mono text-[11px] text-muted">{page.fields.join(', ')}</span>}
            {(page.offersAdded > 0 || page.offersChanged > 0) && (
                <span className="font-mono text-[11px] text-muted tabular-nums">
                    {page.offersAdded > 0 && `+${page.offersAdded}`}
                    {page.offersAdded > 0 && page.offersChanged > 0 && ' '}
                    {page.offersChanged > 0 && `~${page.offersChanged}`}
                </span>
            )}
        </li>
    );
};

/**
 * Taking Habbo's Builders Club catalogue in from a capture of what its client was sent (the
 * Builders Club index and every page). The capture is planned first - the pages and offers to
 * add and bring in line, and what is left out and why - and nothing changes until it is imported,
 * as one step to undo. The normal catalogue's pages are never touched.
 */
export const ImportCapture = ({ tree }: { tree: CatalogTree }) => {
    const [ capture, setCapture ] = useState<{ name: string; json: unknown } | null>(null);
    const [ readError, setReadError ] = useState<string | null>(null);
    const [ takeOthersOut, setTakeOthersOut ] = useState(false);
    const [ publish, setPublish ] = useState(true);
    const plan = useMutation({ mutationFn: (request: ImportRequest) => catalogCalls.previewImport(request) });
    const run = useCatalogEdit(catalogCalls.importCapture);
    const data: ImportPlan | undefined = plan.data;

    const request = (): ImportRequest => ({ capture: capture?.json ?? null, takeOthersOut, publish });

    const pick = async (file: File | undefined) => {
        plan.reset();
        setReadError(null);
        setCapture(null);

        if (!file)
            return;

        try {
            setCapture({ name: file.name, json: JSON.parse(await file.text()) as unknown });
        } catch {
            setReadError(`${file.name} is not JSON.`);
        }
    };

    const runPlan = () => plan.mutate(request());

    const changeTakeOthersOut = (value: boolean) => {
        setTakeOthersOut(value);
        plan.reset();
    };

    const apply = (button: HTMLElement) => {
        ask({
            title: 'Import the Builders Club catalogue?',
            body: `${data?.offersAdded.toLocaleString() ?? 0} offers added and ${data?.offersChanged.toLocaleString() ?? 0} changed, as one step to undo.${publish ? ' It goes live as soon as it is saved.' : ' Nothing goes live until you publish.'}`,
            confirm: 'Import',
        }, () => {
            run.mutate([ request() ], {
                onSuccess: (result) => {
                    celebrate(button);
                    toast(result.saved
                        ? `Imported: ${result.pages.filter(x => x.action === 'add').length.toLocaleString()} pages and ${result.offersAdded.toLocaleString()} offers added.${result.published ? ' It is live.' : ' Look it over, then publish.'}`
                        : 'Nothing to import: the catalogue is in line with the capture.');
                    plan.mutate(request());
                },
                onError: toastError,
            });
        });
    };

    const added = data?.pages.filter(x => x.action === 'add').length ?? 0;
    const updated = data?.pages.filter(x => x.action === 'update').length ?? 0;

    return (
        <div className="grid items-start gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 xl:sticky xl:top-4">
                <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><FileUp className="size-5" /></span>
                    <div>
                        <h2 className="text-sm font-semibold">Import from a Habbo capture</h2>
                        <p className="text-xs leading-relaxed text-muted">A capture of Habbo's Builders Club catalogue - its index and every page - becomes the Builders Club pages here, under the tab it opens on. You see what changes before anything is made; the normal catalogue is left as it is.</p>
                    </div>
                </div>

                <section className="flex flex-col gap-1.5">
                    <Label as="h3">Capture</Label>
                    <input type="file" accept=".json,application/json" aria-label="Capture file" onChange={event => void pick(event.target.files?.[0])} className="text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-subtle file:px-3 file:py-1.5 file:text-xs" />
                    {capture && <span className="font-mono text-[11px] text-muted">{capture.name}</span>}
                    {readError && <span className="text-xs text-warn">{readError}</span>}
                </section>

                <Switch label="Take the other Builders Club pages out" hint="Builders Club pages here that the capture does not have leave it: a page in both catalogues stays in the normal one, a Builders Club page is hidden. Off, they stay." checked={takeOthersOut} onChange={changeTakeOthersOut} />
                <Switch label="Publish when imported" hint="Reloads the catalogue and tells every client online. Off, it waits for you to publish." checked={publish} onChange={setPublish} />

                {plan.error && <ErrorNotice error={plan.error} />}
                <Button icon={<Sparkles />} disabled={!capture || plan.isPending} onClick={runPlan}>
                    {plan.isPending ? 'Planning…' : data ? 'Plan again' : 'Plan it'}
                </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-3">
                {!data && (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-20 text-center text-muted">
                        <Layers className="size-9 text-accent" />
                        <p className="max-w-md text-sm">Pick a capture and plan it. Every page shows here with what happens to it, and what is left out and why, before anything is made.</p>
                    </div>
                )}
                {data && (
                    <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                            {[
                                { label: 'Pages added', value: added },
                                { label: 'Pages changed', value: updated },
                                { label: 'Offers added', value: data.offersAdded },
                                { label: 'Offers changed', value: data.offersChanged },
                                { label: 'Left out', value: data.skipped.length },
                            ].map(x => (
                                <div key={x.label} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                                    <div className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{x.label}</div>
                                    <div className="font-mono text-xl font-semibold tabular-nums">{x.value.toLocaleString()}</div>
                                </div>
                            ))}
                        </div>
                        <p className="text-xs text-muted">
                            Under the tab <span className="font-semibold text-ink">{data.category}</span>. {data.offersUnchanged.toLocaleString()} offers already in line{data.offersKept > 0 && `, ${data.offersKept.toLocaleString()} kept that the capture does not have`}.
                            {!data.changes && ' Nothing to do: the catalogue is in line with the capture.'}
                        </p>
                        {data.warnings.length > 0 && (
                            <ul className="flex flex-col gap-1.5">
                                {data.warnings.map(x => (
                                    <li key={x} className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs">
                                        <TriangleAlert className="mt-px size-3.5 shrink-0 text-warn" />
                                        {x}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="rounded-xl border border-line bg-surface">
                            <div className="border-b border-line px-3 py-2 text-xs text-muted">Pages</div>
                            <ul className="max-h-[32rem] overflow-y-auto p-1.5">
                                {data.pages.map(x => <PageRow key={x.path} page={x} />)}
                                {data.pagesTakenOut.map(x => <PageRow key={`out-${x.pageId}`} page={x} />)}
                            </ul>
                        </div>
                        {(data.skipped.length > 0 || data.missingClasses.length > 0) && (
                            <details className="rounded-xl border border-line bg-surface">
                                <summary className="cursor-pointer px-3 py-2 text-xs text-muted">
                                    Left out: {data.skipped.length.toLocaleString()}{data.missingClasses.length > 0 && `, ${data.missingClasses.length.toLocaleString()} furni classes with no furniture here`}
                                </summary>
                                {data.missingClasses.length > 0 && <p className="px-3 pb-2 font-mono text-[11px] break-words text-muted">{data.missingClasses.join(' ')}</p>}
                                <ul className="max-h-80 overflow-y-auto px-3 pb-2 text-xs">
                                    {data.skipped.map(x => (
                                        <li key={`${x.what}-${x.reason}`} className="flex gap-2 py-0.5">
                                            <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{x.what}</span>
                                            <span className="text-muted">{x.reason}{x.offers > 1 && ` (${x.offers} offers)`}</span>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                        {tree.canManage && data.changes && (
                            <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-accent/50 bg-surface/95 p-3 shadow-xl backdrop-blur">
                                <span className="mr-auto text-xs text-muted">{publish ? 'Live as soon as it is saved.' : 'Nothing goes live until you publish.'}</span>
                                <Button icon={<Hammer />} disabled={run.isPending} onClick={event => apply(event.currentTarget)}>
                                    {run.isPending ? 'Importing…' : 'Import'}
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
