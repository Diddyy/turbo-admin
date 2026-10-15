import { FileUp, Link2, Plus, Save, Search, Trash2, Unlink, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { type GamedataStatus, useDeleteVariable, useLinkVariable, useSaveVariable, useVariableImport, useVariableImportPreview, useVariableSearch, type VariableEntry } from '#/api/gamedata';
import { useSettings } from '#/api/settings';
import { ask } from '#/components/confirm';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, Checkbox, EmptyState, ErrorNotice, Input, Labeled, Loading, Panel, Select, SuccessNotice, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

import { useConfigHandoff } from './configHandoff';
import { OpenRow, ReviewItem } from './parts';

/** Why a value isn't JSON, as the server would refuse it; null when it is. */
const jsonProblem = (value: string) => {
    if (value.trim() === '') return 'A value is JSON: "text" in quotes, true, 120 or [1, 2].';

    try {
        JSON.parse(value);

        return null;
    } catch {
        return 'Not JSON: text goes in "quotes"; true, false, numbers and [lists] don\'t.';
    }
};

/** A variable's JSON value, shown on one line. */
const Value = ({ value }: { value: string }) => <span className="truncate font-mono text-xs text-muted">{value}</span>;

/** What a variable may follow besides a setting: the files, and whether their addresses are written. */
interface Linking {
    files: string[];
    writesAddresses: boolean;
}

/**
 * What a variable follows, if anything - a server setting, or a gamedata file's address by hash -
 * or something to follow. Settings are offered by path to staff who may see them; others type it.
 */
const VariableLink = ({ variable, variableKey, linking, canManage, onDone }: { variable: VariableEntry | null; variableKey: string; linking: Linking; canManage: boolean; onDone: () => void }) => {
    const [ path, setPath ] = useState('');
    const [ file, setFile ] = useState(linking.files[0] ?? '');
    const link = useLinkVariable();
    const { data: settings } = useSettings();
    const linkable = settings?.settings.filter(x => !x.secret) ?? [];
    const follows = variable?.setting ?? variable?.file;

    if (follows)
        return (
            <div className="flex flex-col gap-2 rounded-lg border border-line bg-canvas p-3">
                {variable?.setting && (
                    <p className="text-sm">
                        Follows the setting <span className="font-mono">{variable.setting}</span>: the client gets its value, and the file is built again whenever it changes.
                    </p>
                )}
                {variable?.file && (
                    <p className="text-sm">
                        Follows the address of <span className="font-mono">{variable.file}</span> by its current build, so the client loads exactly that build.
                        {!linking.writesAddresses && ' The gamedata host has no public address (Turbo:Gamedata:PublicUrl), so its own value is written meanwhile.'}
                    </p>
                )}
                {canManage && (
                    <div>
                        <Button variant="secondary" icon={<Unlink />} disabled={link.isPending} onClick={() => link.mutate({ key: variable!.key }, { onSuccess: onDone })}>
                            {variable?.file ? 'Unlink, keeping its /0 address' : 'Unlink, keeping the value'}
                        </Button>
                    </div>
                )}
                {link.error && <ErrorNotice error={link.error} />}
            </div>
        );

    if (!canManage) return null;

    const disabled = variableKey.trim() === '' || link.isPending;

    return (
        <div className="flex flex-col gap-3">
            <Labeled label="Or follow a server setting" hint="The client gets the setting's value, kept up to date. A secret can't be followed: the variables are public.">
                <div className="flex flex-wrap gap-2">
                    <Input value={path} onChange={event => setPath(event.target.value)} list="variable-settings" placeholder="Turbo:Web:HotelName" className="w-full font-mono sm:max-w-96" />
                    <Button variant="secondary" icon={<Link2 />} disabled={path.trim() === '' || disabled} onClick={() => link.mutate({ key: variableKey, setting: path.trim() }, { onSuccess: onDone })}>
                        Link
                    </Button>
                </div>
            </Labeled>
            <datalist id="variable-settings">
                {linkable.map(setting => <option key={setting.path} value={setting.path}>{setting.summary}</option>)}
            </datalist>
            {linking.files.length > 0 && (
                <Labeled label="Or follow a gamedata file's address" hint="Its address by the current build, built again with the file.">
                    <div className="flex flex-wrap gap-2">
                        <Select value={file} onChange={event => setFile(event.target.value)} className="w-full font-mono sm:max-w-72">
                            {linking.files.map(name => <option key={name} value={name}>{name}</option>)}
                        </Select>
                        <Button variant="secondary" icon={<Link2 />} disabled={file === '' || disabled} onClick={() => link.mutate({ key: variableKey, file }, { onSuccess: onDone })}>
                            Link
                        </Button>
                    </div>
                </Labeled>
            )}
            {link.error && <ErrorNotice error={link.error} />}
        </div>
    );
};

/** A variable's value to change, as JSON, or what it follows. */
const VariableEditor = ({ variable, linking, canManage, onDone }: { variable: VariableEntry | null; linking: Linking; canManage: boolean; onDone: () => void }) => {
    const [ key, setKey ] = useState(variable?.key ?? '');
    const [ value, setValue ] = useState(variable?.value ?? '');
    const save = useSaveVariable();
    const remove = useDeleteVariable();
    const problem = jsonProblem(value);
    const changed = !variable || value !== variable.value;

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ key: variable?.key ?? key, value }, { onSuccess: onDone });
            }}
        >
            {!variable && (
                <Labeled label="Key">
                    <Input value={key} onChange={event => setKey(event.target.value)} placeholder="socket.url" className="w-full font-mono sm:max-w-96" autoFocus />
                </Labeled>
            )}
            <Labeled label="Value" hint={variable?.setting || variable?.file ? 'What it follows now. Saving a value of its own unlinks it.' : 'JSON: "text" in quotes, true, 120 or [1, 2].'}>
                <Textarea
                    value={value}
                    onChange={event => setValue(event.target.value)}
                    rows={Math.min(12, Math.max(2, value.split('\n').length, Math.ceil(value.length / 100)))}
                    className="font-mono text-xs"
                    disabled={!canManage}
                />
            </Labeled>
            {canManage && changed && problem && value !== '' && <p className="text-xs text-warn">{problem}</p>}
            <VariableLink variable={variable} variableKey={variable?.key ?? key} linking={linking} canManage={canManage} onDone={onDone} />
            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" icon={variable ? <Save /> : <Plus />} disabled={!changed || !!problem || save.isPending || (!variable && key.trim() === '')}>{variable ? 'Save' : 'Add'}</Button>
                    <Button variant="ghost" icon={<X />} onClick={onDone}>Cancel</Button>
                    {variable && (
                        <Button
                            variant="ghost"
                            icon={<Trash2 />}
                            className="ml-auto text-bad hover:text-bad"
                            disabled={remove.isPending}
                            onClick={() => ask(
                                { title: `Remove the variable ${variable.key}?`, body: 'The client falls back to its own default for it.', confirm: 'Remove' },
                                () => remove.mutate(variable.key, { onSuccess: onDone }),
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
 * A client config taken in whole: pasted or read from a file, looked at, then imported. Keys the
 * hotel lacks are added and those that differ changed; the hotel's other variables stay, or are
 * removed when asked. Variables that follow a setting or a file always stay.
 */
const ImportPanel = ({ initial, onDone }: { initial: string | null; onDone: () => void }) => {
    const [ json, setJson ] = useState(initial ?? '');
    const [ removeMissing, setRemoveMissing ] = useState(false);
    const preview = useVariableImportPreview();
    const looked = useRef(false);

    // A config handed over from the upload is looked at straight away.
    useEffect(() => {
        if (initial && !looked.current) {
            looked.current = true;
            preview.mutate({ json: initial, removeMissing: false });
        }
    }, [ initial, preview ]);

    const take = useVariableImport();
    const seen = preview.data;
    const removing = seen?.removedCount ?? 0;

    return (
        <Panel
            title="Import a client config"
            description="Paste a nitro-config.json, or open one. Its keys are added or changed; the hotel's other variables stay unless you remove them."
            actions={<Button variant="ghost" icon={<X />} onClick={onDone}>Close</Button>}
        >
            <div className="flex flex-col gap-3 p-4">
                <Textarea
                    value={json}
                    onChange={(event) => {
                        setJson(event.target.value);
                        preview.reset();
                        take.reset();
                    }}
                    rows={8}
                    placeholder={'{\n    "socket.url": "wss://hotel.example/ws",\n    "catalog.deep.hierarchy": true\n}'}
                    className="font-mono text-xs"
                    aria-label="Client config"
                />
                <Checkbox
                    label="Remove the hotel's variables the config doesn't have"
                    hint="Variables that follow a setting or a file stay, and so do the Hotel view's (landing.view.*). A config with no keys can't remove anything."
                    checked={removeMissing}
                    onChange={(checked) => {
                        setRemoveMissing(checked);
                        take.reset();

                        if (preview.data) preview.mutate({ json, removeMissing: checked });
                    }}
                />
                <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-accent hover:underline [&>svg]:size-4">
                        <FileUp />
                        Open a file
                        <input
                            type="file"
                            accept=".json,application/json"
                            className="sr-only"
                            onChange={(event) => {
                                const file = event.target.files?.[0];

                                event.target.value = '';

                                if (!file) return;

                                void file.text().then((text) => {
                                    setJson(text);
                                    take.reset();
                                    preview.mutate({ json: text, removeMissing });
                                });
                            }}
                        />
                    </label>
                    <Button variant="secondary" icon={<Search />} disabled={json.trim() === '' || preview.isPending} onClick={() => preview.mutate({ json, removeMissing })}>Look first</Button>
                    {seen && (
                        <Button
                            icon={<Upload />}
                            disabled={seen.added + seen.updated + removing === 0 || take.isPending}
                            onClick={() => ask(
                                {
                                    title: 'Import the config?',
                                    body: `${seen.added} variables are added, ${seen.updated} changed${removing > 0 ? ` and ${removing} removed` : ''}. It can be rolled back from the history.`,
                                    confirm: 'Import',
                                    danger: removing > 0,
                                },
                                () => take.mutate({ json, removeMissing }),
                            )}
                        >
                            Import
                        </Button>
                    )}
                </div>
                {(preview.error || take.error) && <ErrorNotice error={preview.error ?? take.error} />}
                {take.isSuccess && <SuccessNotice>{take.data.changeSet ? `Imported: ${take.data.changeSet.summary}.` : 'The hotel already had all of it.'}</SuccessNotice>}
                {seen && !take.isSuccess && (
                    <p className="text-sm text-muted">
                        {seen.added} to add, {seen.updated} to change,{removeMissing && ` ${removing} to remove,`} {seen.unchanged} already the same.
                        {seen.skipped.length > 0 && ` Left out: ${seen.skipped.join(', ')}.`}
                    </p>
                )}
            </div>
            {seen && !take.isSuccess && seen.items.length + removing > 0 && (
                <ul className="divide-y divide-line border-t border-line">
                    {seen.items.map(item => (
                        <ReviewItem key={item.key} action={item.action} name={item.key}>
                            <div className="flex flex-col gap-0.5 font-mono text-xs break-words">
                                {item.current !== null && <span className="text-muted">Hotel: {item.current}</span>}
                                <span>Config: {item.incoming}</span>
                            </div>
                        </ReviewItem>
                    ))}
                    {seen.truncated && <li className="px-4 py-2.5 text-xs text-muted">And more, not listed.</li>}
                    {seen.removed.map(key => (
                        <li key={`removed:${key}`} className="grid gap-x-3 gap-y-1 px-4 py-2.5 sm:grid-cols-[5.5rem_minmax(10rem,1fr)_2fr]">
                            <span><Badge tone="red">remove</Badge></span>
                            <span className="min-w-0 truncate font-mono text-xs">{key}</span>
                            <span className="text-xs text-muted">Not in the config</span>
                        </li>
                    ))}
                    {removing > seen.removed.length && <li className="px-4 py-2.5 text-xs text-muted">And {removing - seen.removed.length} more to remove, not listed.</li>}
                </ul>
            )}
        </Panel>
    );
};

/**
 * The client's external variables: its configuration, served from the gamedata host as
 * /gamedata/external_variables/0 (the client's nitro.config.url). A variable holds a value of its
 * own, or follows a server setting or a gamedata file's address by hash.
 */
export const VariablesTab = ({ status }: { status: GamedataStatus }) => {
    const [ params ] = useSearchParams();
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<string | null>(() => params.get('open'));
    // A config dropped on the upload opens the import with it.
    const [ handed ] = useState(() => useConfigHandoff.getState().take());
    const [ importing, setImporting ] = useState(handed !== null);
    const { data: found, isFetching, error } = useVariableSearch(text, page);
    const size = found?.pageSize ?? 1;
    const linking: Linking = { files: found?.linkableFiles ?? [], writesAddresses: found?.writesAddresses ?? false };

    return (
        <>
            {importing && <ImportPanel initial={handed} onDone={() => setImporting(false)} />}
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
                        placeholder="Key or value"
                        className="min-w-48 flex-1 sm:max-w-96"
                        aria-label="Find variables"
                    />
                    {status.canManage && (
                        <>
                            <Button variant="secondary" icon={<Upload />} onClick={() => setImporting(true)} disabled={importing}>Import</Button>
                            <Button variant="secondary" icon={<Plus />} onClick={() => setOpen('')}>New variable</Button>
                        </>
                    )}
                </ListToolbar>
                {open === '' && (
                    <div className="border-b border-line bg-subtle/40 p-4">
                        <VariableEditor variable={null} linking={linking} canManage={status.canManage} onDone={() => setOpen(null)} />
                    </div>
                )}
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!found && isFetching && <Loading />}
                {found && found.items.length === 0 && <EmptyState>{text.trim() ? 'No variable has those words.' : 'No variables yet: import the client’s config.'}</EmptyState>}
                {found && found.items.length > 0 && (
                    <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-60')}>
                        {found.items.map(item => (
                            <OpenRow
                                key={item.key}
                                open={open === item.key}
                                onToggle={() => setOpen(open === item.key ? null : item.key)}
                                summary={(
                                    <div className="grid items-center gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(12rem,22rem)_1fr_auto]">
                                        <span className="truncate font-mono text-[13px]">{item.key}</span>
                                        <Value value={item.value} />
                                        <span className="max-sm:hidden">{(item.setting ?? item.file) && <Badge tone="accent" className="max-w-64 truncate"><Link2 className="size-3" /> {item.setting ?? item.file}</Badge>}</span>
                                    </div>
                                )}
                            >
                                <VariableEditor key={`${item.value}|${item.setting ?? ''}|${item.file ?? ''}`} variable={item} linking={linking} canManage={status.canManage} onDone={() => setOpen(null)} />
                            </OpenRow>
                        ))}
                    </ul>
                )}
            </Panel>
        </>
    );
};
