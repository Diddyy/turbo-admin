import { Link2, Save } from 'lucide-react';
import { useState } from 'react';

import { type PluginSource, type PluginSourceFollow, type PluginSourceInput, useAddPluginSource, useEditPluginSource } from '#/api/plugins';
import { Modal } from '#/components/Modal';
import { toast } from '#/components/toast';
import { Button, Checkbox, ErrorNotice, Field, Labeled, Segmented, Switch } from '#/components/ui';

const FOLLOWS: { value: PluginSourceFollow; label: string }[] = [
    { value: 'latest', label: 'Newest release' },
    { value: 'tag', label: 'One tag' },
];

const inputOf = (source: PluginSource | null): PluginSourceInput => source
    ? { repository: source.repository, follow: source.follow, tag: source.tag, folder: source.folder, token: '', autoUpdate: source.autoUpdate }
    : { repository: '', follow: 'latest', tag: null, folder: null, token: '', autoUpdate: false };

/**
 * Links a GitHub repository to install a plugin from, or edits a link (`source`). The saved token
 * is never sent back: left empty it is kept, and it can be cleared on purpose. Linking installs the
 * release at once.
 */
export const PluginSourceForm = ({ source, allowed, onClose }: { source: PluginSource | null; allowed: string[]; onClose: () => void }) => {
    const [ input, setInput ] = useState(() => inputOf(source));
    const [ clearToken, setClearToken ] = useState(false);
    const add = useAddPluginSource();
    const edit = useEditPluginSource();
    const saving = add.isPending || edit.isPending;
    const set = (change: Partial<PluginSourceInput>) => setInput(current => ({ ...current, ...change }));

    const submit = () => {
        const token = source === null ? input.token : clearToken ? '' : input.token ? input.token : undefined;
        const body: PluginSourceInput = {
            ...input,
            repository: input.repository.trim(),
            tag: input.follow === 'tag' ? input.tag?.trim() ?? null : null,
            folder: input.folder?.trim() || null,
            token,
        };
        const done = {
            onSuccess: (result: { message: string }) => {
                toast(result.message);
                onClose();
            },
        };

        if (source)
            edit.mutate({ id: source.id, input: body }, done);
        else
            add.mutate(body, done);
    };

    return (
        <Modal open onClose={onClose} title={source ? `Edit ${source.repository}` : 'Link a GitHub repository'} className="sm:h-fit! sm:max-w-xl">
            <form
                className="flex flex-col gap-4 p-4 sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <Field
                    label="Repository"
                    name="source-repository"
                    value={input.repository}
                    onChange={event => set({ repository: event.target.value })}
                    placeholder="https://github.com/owner/repo"
                    hint={allowed.length > 0 ? `From ${allowed.join(', ')} only (Turbo:Plugin:AllowedSources).` : 'A release installs the plugin\'s sources at its tag, which the server compiles.'}
                    disabled={source !== null}
                    required
                    autoFocus={source === null}
                    className="w-full font-mono"
                />

                <Labeled label="Follow">
                    <Segmented label="Follow" value={input.follow} onChange={value => set({ follow: value as PluginSourceFollow })} options={FOLLOWS} />
                </Labeled>

                {input.follow === 'tag' && (
                    <Field label="Tag" name="source-tag" value={input.tag ?? ''} onChange={event => set({ tag: event.target.value })} placeholder="v1.0.0" required className="w-full font-mono" />
                )}

                <Field
                    label="Folder"
                    name="source-folder"
                    value={input.folder ?? ''}
                    onChange={event => set({ folder: event.target.value })}
                    placeholder="The only folder with a manifest.json"
                    hint="The folder holding the plugin's manifest.json, only when the repository has more than one plugin."
                    className="w-full font-mono"
                />

                <div className="flex flex-col gap-1.5">
                    <Field
                        label="Token"
                        name="source-token"
                        type="password"
                        autoComplete="new-password"
                        value={input.token ?? ''}
                        disabled={clearToken}
                        onChange={event => set({ token: event.target.value })}
                        placeholder={source?.hasToken ? 'Leave empty to keep' : ''}
                        hint={source?.hasToken ? 'Leave empty to keep the saved one.' : 'For a private repository: a token that can read its contents. It is kept sealed and never shown.'}
                    />
                    {source?.hasToken && (
                        <Checkbox
                            label="Clear the saved token"
                            checked={clearToken}
                            onChange={(checked) => {
                                setClearToken(checked);
                                set({ token: '' });
                            }}
                        />
                    )}
                </div>

                <Switch
                    label="Update on its own"
                    hint="A newer release found by the scheduled check is installed without asking, except one rolled back from."
                    checked={input.autoUpdate}
                    onChange={autoUpdate => set({ autoUpdate })}
                />

                {(add.error ?? edit.error) && <ErrorNotice error={add.error ?? edit.error} />}

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" icon={source ? <Save /> : <Link2 />} disabled={saving}>
                        {source ? 'Save' : 'Link and install'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
