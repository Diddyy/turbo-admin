import { useMutation } from '@tanstack/react-query';
import { Download, FileUp, Hammer, ImageOff, Layers, Sparkles, TriangleAlert } from 'lucide-react';
import { useState } from 'react';

import { catalogCalls, type CatalogTree, type ImportPageChange, type ImportPlan, type LogImportPlan, useCatalogEdit } from '#/api/catalog';
import { useFetchCatalogPictures } from '#/api/catalogImages';
import { ask } from '#/components/confirm';
import { celebrate, toast, toastError } from '#/components/toast';
import { Button, EmptyState, ErrorNotice, Label, Segmented, Stat, Switch } from '#/components/ui';
import { cx } from '#/lib/cx';

const ACTIONS: Record<ImportPageChange['action'], { label: string; tone: string }> = {
    add: { label: 'add', tone: 'bg-accent-soft text-accent' },
    update: { label: 'update', tone: 'bg-warn-soft text-warn' },
    unchanged: { label: 'same', tone: 'bg-subtle text-muted' },
    out: { label: 'take out', tone: 'bg-warn-soft text-warn' },
};

const CATALOGS: Record<ImportPlan['catalog'], string> = {
    NORMAL: 'Normal catalogue',
    BUILDERS_CLUB: 'Builders Club',
};

type Source = 'logs' | 'capture';

const SOURCES: { value: Source; label: string }[] = [
    { value: 'logs', label: 'Packet logs' },
    { value: 'capture', label: 'JSON capture' },
];

const LOG_ACCEPT = '.txt,.log,text/plain';

const FILE_INPUT = 'text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-subtle file:px-3 file:py-1.5 file:text-xs';

/** A JSON capture is of the Builders Club alone. */
const asLogPlan = (plan: ImportPlan): LogImportPlan => ({ normal: null, buildersClub: plan, changes: plan.changes });

const plansOf = (data: LogImportPlan) => [ data.normal, data.buildersClub ].filter((x): x is ImportPlan => x !== null);

/** A page of the plan, indented by how deep it sits under the tree the catalogue is taken into. */
const PageRow = ({ page, top }: { page: ImportPageChange; top: number }) => {
    const action = ACTIONS[page.action];
    const depth = Math.max(0, page.path.split('/').length - top);

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
 * The pictures a plan's pages show that this hotel has no file of: the client shows nothing there
 * until they are taken in from Habbo, which runs as an asset job, and the assets are published.
 */
const MissingPictures = ({ names, canManage }: { names: string[]; canManage: boolean }) => {
    const fetch = useFetchCatalogPictures();

    const doFetch = () => fetch.mutate(names, {
        onSuccess: () => toast(`Taking ${names.length.toLocaleString()} pictures in from Habbo: follow it on the Assets page, then publish the assets for players to see them.`),
        onError: toastError,
    });

    return (
        <details className="rounded-xl border border-warn-line bg-warn-soft/40">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-xs">
                <ImageOff className="size-3.5 text-warn" />
                <span className="min-w-0 flex-1">{names.length.toLocaleString()} headers and teasers this hotel has no picture of: the pages show nothing there until they are taken in.</span>
                {canManage && (
                    <Button
                        variant="secondary"
                        icon={<Download />}
                        disabled={fetch.isPending}
                        onClick={(event) => {
                            event.preventDefault();
                            doFetch();
                        }}
                    >
                        Fetch from Habbo
                    </Button>
                )}
            </summary>
            <p className="px-3 pb-2 font-mono text-[11px] break-words text-muted">{names.join(' · ')}</p>
        </details>
    );
};

/** One catalogue's plan: what is added and changed, the pages, and what is left out and why. */
const PlanView = ({ plan, canManage }: { plan: ImportPlan; canManage: boolean }) => {
    const builders = plan.catalog === 'BUILDERS_CLUB';
    const added = plan.pages.filter(x => x.action === 'add').length;
    const updated = plan.pages.filter(x => x.action === 'update').length;

    return (
        <section className="flex min-w-0 flex-col gap-3">
            <h3 className="text-sm font-semibold">{CATALOGS[plan.catalog]}</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {[
                    { label: 'Pages added', value: added },
                    { label: 'Pages changed', value: updated },
                    { label: 'Offers added', value: plan.offersAdded },
                    { label: 'Offers changed', value: plan.offersChanged },
                    { label: 'Left out', value: plan.skipped.length },
                ].map(x => <Stat key={x.label} label={x.label} value={x.value.toLocaleString()} compact />)}
            </div>
            <p className="text-xs text-muted">
                {builders ? <>Under the tab <span className="font-semibold text-ink">{plan.category}</span>. </> : 'Into the catalogue\'s own tabs. '}
                {plan.offersUnchanged.toLocaleString()} offers already in line{plan.offersKept > 0 && `, ${plan.offersKept.toLocaleString()} kept that the capture does not have`}.
                {!plan.changes && ' Nothing to do: the catalogue is in line with the capture.'}
            </p>
            {plan.warnings.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                    {plan.warnings.map(x => (
                        <li key={x} className="flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs break-words">
                            <TriangleAlert className="mt-px size-3.5 shrink-0 text-warn" />
                            <span className="min-w-0">{x}</span>
                        </li>
                    ))}
                </ul>
            )}
            {plan.missingPictures.length > 0 && <MissingPictures names={plan.missingPictures} canManage={canManage} />}
            <div className="rounded-xl border border-line bg-surface">
                <div className="border-b border-line px-3 py-2 text-xs text-muted">Pages</div>
                <ul className="max-h-[32rem] overflow-y-auto p-1.5">
                    {plan.pages.map(x => <PageRow key={x.path} page={x} top={builders ? 3 : 2} />)}
                    {plan.pagesTakenOut.map(x => <PageRow key={`out-${x.pageId}`} page={x} top={2} />)}
                </ul>
            </div>
            {(plan.skipped.length > 0 || plan.missingClasses.length > 0) && (
                <details className="rounded-xl border border-line bg-surface">
                    <summary className="cursor-pointer px-3 py-2 text-xs text-muted">
                        Left out: {plan.skipped.length.toLocaleString()}{plan.missingClasses.length > 0 && `, ${plan.missingClasses.length.toLocaleString()} furni with no furniture here`}
                    </summary>
                    {plan.missingClasses.length > 0 && <p className="px-3 pb-2 font-mono text-[11px] break-words text-muted">{plan.missingClasses.join(' · ')}</p>}
                    <ul className="max-h-80 overflow-y-auto px-3 pb-2 text-xs">
                        {plan.skipped.map(x => (
                            <li key={`${x.what}-${x.reason}`} className="flex gap-2 py-0.5">
                                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{x.what}</span>
                                <span className="text-muted">{x.reason}{x.offers > 1 && ` (${x.offers} offers)`}</span>
                            </li>
                        ))}
                    </ul>
                </details>
            )}
        </section>
    );
};

const LogInput = ({ label, file, onPick }: { label: string; file: File | null; onPick: (file: File | null) => void }) => (
    <section className="flex flex-col gap-1.5">
        <Label as="h3">{label}</Label>
        <input type="file" accept={LOG_ACCEPT} aria-label={label} onChange={event => onPick(event.target.files?.[0] ?? null)} className={FILE_INPUT} />
        {file && <span className="font-mono text-[11px] text-muted">{file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB</span>}
    </section>
);

/**
 * Taking Habbo's catalogues in from what its client was sent: packet logs of the normal
 * catalogue, the Builders Club, or both (its index and each page opened), or a JSON capture of
 * the Builders Club. Planned first - the pages and offers to add and bring in line, and what is
 * left out and why - and nothing changes until it is imported, as one step to undo.
 */
export const ImportCapture = ({ tree }: { tree: CatalogTree }) => {
    const [ source, setSource ] = useState<Source>('logs');
    const [ normalLog, setNormalLog ] = useState<File | null>(null);
    const [ buildersLog, setBuildersLog ] = useState<File | null>(null);
    const [ capture, setCapture ] = useState<{ name: string; json: unknown } | null>(null);
    const [ readError, setReadError ] = useState<string | null>(null);
    const [ takeOthersOut, setTakeOthersOut ] = useState(false);
    const [ publish, setPublish ] = useState(true);

    const call = async (logs: boolean, apply: boolean): Promise<LogImportPlan> => {
        if (logs) {
            const request = { normal: normalLog, buildersClub: buildersLog, takeOthersOut, publish };

            return apply ? catalogCalls.importLogs(request) : catalogCalls.previewLogImport(request);
        }

        const request = { capture: capture?.json ?? null, takeOthersOut, publish };

        return asLogPlan(await (apply ? catalogCalls.importCapture(request) : catalogCalls.previewImport(request)));
    };

    const plan = useMutation({ mutationFn: () => call(source === 'logs', false) });
    const run = useCatalogEdit(() => call(source === 'logs', true));
    const data = plan.data;
    const ready = source === 'logs' ? !!(normalLog || buildersLog) : !!capture;

    const changeSource = (value: string) => {
        setSource(value as Source);
        plan.reset();
    };

    const pickLog = (set: (file: File | null) => void) => (file: File | null) => {
        plan.reset();
        set(file);
    };

    const pickCapture = async (file: File | undefined) => {
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

    const changeTakeOthersOut = (value: boolean) => {
        setTakeOthersOut(value);
        plan.reset();
    };

    const apply = (button: HTMLElement) => {
        const plans = data ? plansOf(data) : [];
        const offersAdded = plans.reduce((sum, x) => sum + x.offersAdded, 0);
        const offersChanged = plans.reduce((sum, x) => sum + x.offersChanged, 0);

        ask({
            title: plans.length > 1 ? 'Import both catalogues?' : `Import the ${plans[0]?.catalog === 'NORMAL' ? 'normal' : 'Builders Club'} catalogue?`,
            body: `${offersAdded.toLocaleString()} offers added and ${offersChanged.toLocaleString()} changed, as one step to undo.${publish ? ' It goes live as soon as it is saved.' : ' Nothing goes live until you publish.'}`,
            confirm: 'Import',
        }, () => {
            run.mutate([], {
                onSuccess: (result) => {
                    const done = plansOf(result);
                    const saved = done.some(x => x.saved);
                    const pages = done.reduce((sum, x) => sum + x.pages.filter(p => p.action === 'add').length, 0);
                    const offers = done.reduce((sum, x) => sum + x.offersAdded, 0);

                    celebrate(button);
                    toast(saved
                        ? `Imported: ${pages.toLocaleString()} pages and ${offers.toLocaleString()} offers added.${done.some(x => x.published) ? ' It is live.' : ' Look it over, then publish.'}`
                        : 'Nothing to import: the catalogue is in line with the capture.');
                    plan.mutate();
                },
                onError: toastError,
            });
        });
    };

    return (
        <div className="grid items-start gap-4 xl:grid-cols-[24rem_minmax(0,1fr)]">
            <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 xl:sticky xl:top-4">
                <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><FileUp className="size-5" /></span>
                    <div>
                        <h2 className="text-sm font-semibold">Import from Habbo</h2>
                        <p className="text-xs leading-relaxed text-muted">What Habbo's client was sent - a catalogue's index and its pages - becomes the pages here. You see what changes before anything is made.</p>
                    </div>
                </div>

                <Segmented label="Source" value={source} onChange={changeSource} options={SOURCES} />

                {source === 'logs' && (
                    <>
                        <p className="text-xs leading-relaxed text-muted">From a packet logger: open the catalogue, then each page to take in, and save the log. Give either catalogue's log, or both; the normal catalogue is made first.</p>
                        <LogInput label="Normal catalogue log" file={normalLog} onPick={pickLog(setNormalLog)} />
                        <LogInput label="Builders Club log" file={buildersLog} onPick={pickLog(setBuildersLog)} />
                    </>
                )}

                {source === 'capture' && (
                    <section className="flex flex-col gap-1.5">
                        <Label as="h3">Builders Club capture</Label>
                        <input type="file" accept=".json,application/json" aria-label="Capture file" onChange={event => void pickCapture(event.target.files?.[0])} className={FILE_INPUT} />
                        {capture && <span className="font-mono text-[11px] text-muted">{capture.name}</span>}
                        {readError && <span className="text-xs text-warn">{readError}</span>}
                    </section>
                )}

                <Switch label="Take the other pages out" hint="Pages here that the capture does not have leave its catalogue: out of the Builders Club (a page in both stays in the normal one), or hidden in the normal catalogue (but for those that lead to Builders Club pages). Off, they stay." checked={takeOthersOut} onChange={changeTakeOthersOut} />
                <Switch label="Publish when imported" hint="Reloads the catalogue and tells every client online. Off, it waits for you to publish." checked={publish} onChange={setPublish} />

                {plan.error && <ErrorNotice error={plan.error} />}
                <Button icon={<Sparkles />} disabled={!ready || plan.isPending} onClick={() => plan.mutate()}>
                    {plan.isPending ? 'Planning…' : data ? 'Plan again' : 'Plan it'}
                </Button>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
                {!data && (
                    <EmptyState framed icon={<Layers className="text-accent" />}>
                        Pick a log or a capture and plan it. Every page shows here with what happens to it, and what is left out and why, before anything is made.
                    </EmptyState>
                )}
                {data && plansOf(data).map(x => <PlanView key={x.catalog} plan={x} canManage={tree.canManage} />)}
                {data && tree.canManage && data.changes && (
                    <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-accent/50 bg-surface/95 p-3 shadow-xl backdrop-blur">
                        <span className="mr-auto text-xs text-muted">{publish ? 'Live as soon as it is saved.' : 'Nothing goes live until you publish.'}</span>
                        <Button icon={<Hammer />} disabled={run.isPending} onClick={event => apply(event.currentTarget)}>
                            {run.isPending ? 'Importing…' : 'Import'}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
