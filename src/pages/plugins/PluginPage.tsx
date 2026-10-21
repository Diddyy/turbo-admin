import { useQueryClient } from '@tanstack/react-query';
import { Download, Play, Send, Trash2 } from 'lucide-react';
import { Fragment, type ReactNode, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { endpointOf, type PluginAction, pluginBlob, type PluginBlock, type PluginColumn, type PluginField, type PluginList, type PluginPages, usePluginCall, usePluginData, usePluginPages } from '#/api/pluginPages';
import { ask } from '#/components/confirm';
import { ListToolbar } from '#/components/ListToolbar';
import { Pagination } from '#/components/Pagination';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, Checkbox, EmptyState, ErrorNotice, Input, Kv, Labeled, Loading, PageBody, PageHeader, Panel, Select, Stat, Td, Textarea, Th, WarningNotice } from '#/components/ui';
import { fromNow } from '#/lib/time';

type Item = Record<string, unknown>;

interface Context {
    plugin: PluginPages;
    /** The item a detail page is about (its route's id). */
    id: string | undefined;
    /** Where "back" goes: the plugin's page the item is listed on. */
    back: string | undefined;
}

/** A value as a column of its type shows it. */
const Cell = ({ column, value }: { column: PluginColumn; value: unknown }) => {
    if (value === null || value === undefined || value === '')
        return <span className="text-muted">-</span>;

    switch (column.type) {
        case 'time':
            return <span className="text-xs text-muted" title={String(value)}>{fromNow(String(value))}</span>;
        case 'bool':
            return value ? <Badge tone="green">yes</Badge> : <span className="text-muted">no</span>;
        case 'badge':
            return <Badge tone={value === 'open' ? 'amber' : value === 'resolved' ? 'green' : 'neutral'}>{String(value)}</Badge>;
        case 'number':
            return <span className="font-mono tabular-nums">{String(value)}</span>;
        default:
            return <span>{String(value)}</span>;
    }
};

/** Whether an action's `key=value` holds for the item. */
const applies = (action: PluginAction, item: Item | undefined) => {
    if (!action.when)
        return true;

    const [ key, value ] = action.when.split('=');

    return String(item?.[key!]) === value;
};

/** Paragraphs, with `**bold**`: all a text block holds. */
const TextBlock = ({ block }: { block: PluginBlock }) => (
    <Panel title={block.title ?? undefined}>
        <div className="flex flex-col gap-2 px-4 py-3 text-sm">
            {(block.text ?? '').split(/\n{2,}/).map((paragraph, i) => (
                <p key={i}>{paragraph.split(/\*\*(.+?)\*\*/g).map((part, j) => j % 2 ? <strong key={j}>{part}</strong> : <Fragment key={j}>{part}</Fragment>)}</p>
            ))}
        </div>
    </Panel>
);

const StatsBlock = ({ block, context }: { block: PluginBlock; context: Context }) => {
    const { data, error } = usePluginData<{ label: string; value: ReactNode }[]>(context.plugin.key, endpointOf(block.endpoint ?? '', context.id));

    if (error) return <ErrorNotice error={error} />;

    return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(data ?? []).map(tile => <Stat key={tile.label} label={tile.label} value={tile.value} />)}
        </div>
    );
};

const TableBlock = ({ block, context }: { block: PluginBlock; context: Context }) => {
    const [ page, setPage ] = useState(0);
    const [ filters, setFilters ] = useState<Record<string, string>>({});
    const query = new URLSearchParams({ page: String(page), ...Object.fromEntries(Object.entries(filters).filter(([ , v ]) => v !== '')) });
    const { data, error, isFetching } = usePluginData<PluginList>(context.plugin.key, `${endpointOf(block.endpoint ?? '', context.id)}?${query}`);
    const columns = block.columns ?? [];
    const filter = (name: string, value: string) => {
        setPage(0);
        setFilters({ ...filters, [name]: value });
    };
    const rowLink = (item: Item) => block.itemPage ? `/plugin/${context.plugin.key}/${block.itemPage}/${encodeURIComponent(String(item.id))}` : undefined;

    return (
        <Panel title={block.title ?? undefined} className="overflow-clip">
            {(block.filters?.length ?? 0) > 0 && (
                <ListToolbar watch={[ filters ]}>
                    {block.filters!.map(field => field.type === 'select'
                        ? (
                                <Select key={field.key} aria-label={field.label} value={filters[field.key] ?? ''} onChange={event => filter(field.key, event.target.value)} className="w-40">
                                    {(field.options ?? []).map(option => <option key={option} value={option}>{option === '' ? `Any ${field.label.toLowerCase()}` : option}</option>)}
                                </Select>
                            )
                        : <Input key={field.key} aria-label={field.label} placeholder={field.label} value={filters[field.key] ?? ''} onChange={event => filter(field.key, event.target.value)} className="min-w-48 flex-1 sm:max-w-80" />)}
                </ListToolbar>
            )}
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {!error && !data && <Loading />}
            {data && data.items.length === 0 && <EmptyState>{isFetching ? 'Looking...' : 'Nothing here.'}</EmptyState>}
            {data && data.items.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr>{columns.map(column => <Th key={column.key}>{column.label}</Th>)}</tr></thead>
                        <tbody className="[&>tr:last-child>td]:border-b-0">
                            {data.items.map((item, i) => (
                                <tr key={String(item.id ?? i)} className="hover:bg-subtle/60">
                                    {columns.map((column, c) => (
                                        <Td key={column.key} className={column.key === 'text' ? 'max-w-96 truncate' : undefined}>
                                            {c === 0 && rowLink(item)
                                                ? <Link to={rowLink(item)!} className="font-medium hover:text-accent"><Cell column={column} value={item[column.key]} /></Link>
                                                : <Cell column={column} value={item[column.key]} />}
                                        </Td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {data && data.total > data.pageSize && <Pagination offset={page * data.pageSize} limit={data.pageSize} total={data.total} onChange={offset => setPage(Math.floor(offset / data.pageSize))} />}
        </Panel>
    );
};

/** A file of the plugin's, saved as the browser saves a download. */
const save = async (key: string, endpoint: string, name: string) => {
    const url = URL.createObjectURL(await pluginBlob(key, endpoint));
    const link = document.createElement('a');

    link.href = url;
    link.download = name;
    link.click();
    URL.revokeObjectURL(url);
};

const PluginImage = ({ pluginKey, endpoint }: { pluginKey: string; endpoint: string }) => {
    const [ url, setUrl ] = useState<string | null>(null);

    useEffect(() => {
        let made: string | null = null;

        pluginBlob(pluginKey, endpoint).then((blob) => {
            made = URL.createObjectURL(blob);
            setUrl(made);
        }).catch(() => setUrl(null));

        return () => {
            if (made) URL.revokeObjectURL(made);
        };
    }, [ pluginKey, endpoint ]);

    return url ? <img src={url} alt="" className="max-h-[28rem] max-w-full rounded-lg border border-line" /> : null;
};

const DetailBlock = ({ block, context }: { block: PluginBlock; context: Context }) => {
    const { data, error } = usePluginData<Item>(context.plugin.key, endpointOf(block.endpoint ?? '', context.id));

    if (error) return <ErrorNotice error={error} />;

    if (!data) return <Loading />;

    const downloads = (block.downloads ?? []).filter(x => applies(x, data));

    return (
        <Panel title={block.title ?? undefined}>
            <div className="flex flex-col gap-4 px-4 py-3">
                <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    {(block.columns ?? []).map(column => <Kv key={column.key} label={column.label}><Cell column={column} value={data[column.key]} /></Kv>)}
                </dl>
                {block.image && data.image !== false && <PluginImage pluginKey={context.plugin.key} endpoint={endpointOf(block.image, context.id)} />}
                {downloads.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {downloads.map(download => (
                            <Button key={download.label} variant="secondary" icon={<Download />} onClick={() => save(context.plugin.key, endpointOf(download.endpoint, context.id), `${context.plugin.key}-${context.id}-${download.label}`.replace(/[^\w.-]+/g, '-')).catch(toastError)}>
                                {download.label}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </Panel>
    );
};

/** The detail the page is about, from its first detail block: what actions' `when` reads. */
const usePageItem = (key: string, blocks: PluginBlock[], id: string | undefined) => {
    const detail = blocks.find(x => x.type === 'detail');

    return usePluginData<Item>(key, detail?.endpoint ? endpointOf(detail.endpoint, id) : null).data;
};

const ActionsBlock = ({ block, context, item }: { block: PluginBlock; context: Context; item: Item | undefined }) => {
    const call = usePluginCall();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [ busy, setBusy ] = useState(false);
    const shown = (block.actions ?? []).filter(x => (!x.node || context.plugin.nodes.includes(x.node)) && applies(x, item));

    if (shown.length === 0) return null;

    const run = (action: PluginAction) => {
        const go = async () => {
            setBusy(true);

            try {
                await call(context.plugin.key, endpointOf(action.endpoint, context.id), { method: action.method });
                toast(`${action.label}: done.`);

                if (action.then === 'back')
                    void (context.back ? navigate(context.back) : navigate(-1));

                void queryClient.invalidateQueries({ queryKey: [ 'plugin', context.plugin.key ] });
            } catch (error) {
                toastError(error);
            } finally {
                setBusy(false);
            }
        };

        if (action.confirm) ask({ title: action.confirm, confirm: action.label, danger: action.danger }, () => void go());
        else void go();
    };

    return (
        <Panel title={block.title ?? undefined}>
            <div className="flex flex-wrap gap-2 px-4 py-3">
                {shown.map(action => (
                    <Button key={action.label} variant={action.danger ? 'danger' : 'secondary'} disabled={busy} icon={action.danger ? <Trash2 /> : action.method === 'POST' ? <Send /> : <Play />} onClick={() => run(action)}>
                        {action.label}
                    </Button>
                ))}
            </div>
        </Panel>
    );
};

/** A field's problem, or null: the plugin checks again. */
const problemOf = (field: PluginField, value: unknown) => {
    const text = value === undefined || value === null ? '' : String(value);

    if (field.required && text === '') return `${field.label} is needed.`;

    if (field.type === 'number' && text !== '') {
        const number = Number(text);

        if (Number.isNaN(number)) return `${field.label} is a number.`;
        if (field.min !== null && number < field.min) return `${field.label} is at least ${field.min}.`;
        if (field.max !== null && number > field.max) return `${field.label} is at most ${field.max}.`;
    }

    if (field.pattern && text !== '' && !new RegExp(`^(?:${field.pattern})$`).test(text)) return `${field.label} doesn't have the right form.`;

    return null;
};

/**
 * A form; on an item's page each field starts from the item's value of the same key (what the
 * page's detail block shows), and only the fields staff changed are sent.
 */
const FormBlock = ({ block, context, item }: { block: PluginBlock; context: Context; item: Item | undefined }) => {
    const call = usePluginCall();
    const queryClient = useQueryClient();
    const [ values, setValues ] = useState<Record<string, unknown>>({});
    const [ busy, setBusy ] = useState(false);
    const fields = block.fields ?? [];
    const valueOf = (key: string) => (key in values) ? values[key] : item?.[key];
    const problems = fields.map(field => problemOf(field, valueOf(field.key))).filter(Boolean);

    return (
        <Panel title={block.title ?? undefined}>
            <form
                className="flex flex-col gap-3 px-4 py-3"
                onSubmit={(event) => {
                    event.preventDefault();

                    if (!block.submit || problems.length > 0) return;

                    setBusy(true);
                    call(context.plugin.key, endpointOf(block.submit.endpoint, context.id), { method: block.submit.method, body: JSON.stringify(values) })
                        .then(async () => {
                            toast(`${block.submit!.label}: done.`);
                            await queryClient.invalidateQueries({ queryKey: [ 'plugin', context.plugin.key ] });
                            // The item, read again, shows what was saved.
                            setValues({});
                        })
                        .catch(toastError)
                        .finally(() => setBusy(false));
                }}
            >
                {fields.map(field => (
                    <Labeled key={field.key} label={field.label} hint={field.hint ?? undefined}>
                        {field.type === 'bool' && <Checkbox label={field.label} checked={!!valueOf(field.key)} onChange={checked => setValues({ ...values, [field.key]: checked })} />}
                        {field.type === 'textarea' && <Textarea value={String(valueOf(field.key) ?? '')} onChange={event => setValues({ ...values, [field.key]: event.target.value })} />}
                        {field.type === 'select' && (
                            <Select value={String(valueOf(field.key) ?? '')} onChange={event => setValues({ ...values, [field.key]: event.target.value })}>
                                {[ '', ...(field.options ?? []) ].map(option => <option key={option} value={option}>{option}</option>)}
                            </Select>
                        )}
                        {(field.type === 'text' || field.type === 'number') && <Input type={field.type} value={String(valueOf(field.key) ?? '')} onChange={event => setValues({ ...values, [field.key]: field.type === 'number' && event.target.value !== '' ? Number(event.target.value) : event.target.value })} />}
                    </Labeled>
                ))}
                {problems.length > 0 && <p className="text-xs text-warn">{problems[0]}</p>}
                {block.submit && <div><Button type="submit" disabled={busy || problems.length > 0}>{block.submit.label}</Button></div>}
            </form>
        </Panel>
    );
};

const Block = ({ block, context, item }: { block: PluginBlock; context: Context; item: Item | undefined }) => {
    switch (block.type) {
        case 'text': return <TextBlock block={block} />;
        case 'stats': return <StatsBlock block={block} context={context} />;
        case 'table': return <TableBlock block={block} context={context} />;
        case 'detail': return <DetailBlock block={block} context={context} />;
        case 'actions': return <ActionsBlock block={block} context={context} item={item} />;
        case 'form': return <FormBlock block={block} context={context} item={item} />;
        default: return <WarningNotice>This page has a block of a kind this panel can't show ({block.type}). Update the panel, or ask the plugin's author.</WarningNotice>;
    }
};

/**
 * A page a plugin adds, drawn from its schema with the panel's own components: no plugin code
 * runs here. When the plugin is reloaded, turned off or taken away under an open tab, the page
 * says so rather than showing what it no longer serves.
 */
export const PluginPage = () => {
    const { key, page: pageId, id } = useParams();
    const { data: plugins, error } = usePluginPages();
    const plugin = plugins?.find(x => x.key === key);
    const page = plugin?.pages.find(x => x.id === pageId);
    const item = usePageItem(key ?? '', page?.blocks ?? [], id);

    // Under the same header as the page it becomes, so nothing jumps when it arrives.
    if (error || !plugins)
        return (
            <>
                <PageHeader title="Plugin page" />
                {error ? <PageBody><ErrorNotice error={error} /></PageBody> : <Loading />}
            </>
        );

    if (!plugin || !page)
        return (
            <>
                <PageHeader title="Plugin page" />
                <PageBody>
                    <WarningNotice>
                        This page isn't there any more: the plugin {key} was reloaded, turned off or taken away, or you can't see it. <Link to="/plugins" className="underline">Plugins</Link> says which.
                    </WarningNotice>
                </PageBody>
            </>
        );

    const parent = id ? plugin.pages.find(x => x.nav) : undefined;

    return (
        <>
            <PageHeader
                title={id ? `${page.title} #${id}` : page.title}
                description={page.description ?? `From the plugin ${plugin.name} ${plugin.version}`}
                back={parent ? { to: `/plugin/${plugin.key}/${parent.id}`, label: parent.title } : undefined}
            />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {page.blocks.map((block, i) => <Block key={`${plugin.revision}-${i}`} block={block} context={{ plugin, id, back: parent && `/plugin/${plugin.key}/${parent.id}` }} item={item} />)}
            </PageBody>
        </>
    );
};
