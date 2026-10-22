import { Save } from 'lucide-react';
import { useState } from 'react';

import { type AssetTarget, type AssetTargetInput, DEFAULT_PORTS, PROTOCOLS, type TargetProtocol, useSaveTarget } from '#/api/bundles';
import { Modal } from '#/components/Modal';
import { toast } from '#/components/toast';
import { Button, Checkbox, ErrorNotice, Field, Labeled, Segmented, Switch } from '#/components/ui';

const blank: AssetTargetInput = { name: '', protocol: 'sftp', host: '', port: 0, user: '', password: '', remotePath: '', publicUrl: '', allowSelfSigned: false, cloudflareZoneId: '', cloudflareToken: '' };

const inputOf = (target: AssetTarget | null): AssetTargetInput => target
    ? { name: target.name, protocol: target.protocol, host: target.host, port: target.port, user: target.user, password: '', remotePath: target.remotePath, publicUrl: target.publicUrl, allowSelfSigned: target.allowSelfSigned, cloudflareZoneId: target.cloudflareZoneId, cloudflareToken: '' }
    : blank;

/**
 * Adds a publish target, or edits one (`target`). The saved password and Cloudflare token are never
 * sent back: left empty they are kept, and they can be cleared on purpose.
 */
export const TargetForm = ({ target, onClose }: { target: AssetTarget | null; onClose: () => void }) => {
    const [ input, setInput ] = useState(() => inputOf(target));
    const [ clearPassword, setClearPassword ] = useState(false);
    const [ clearToken, setClearToken ] = useState(false);
    const save = useSaveTarget();
    const remote = input.protocol !== 'folder';
    const set = (change: Partial<AssetTargetInput>) => setInput(current => ({ ...current, ...change }));

    const submit = () => {
        const password = !remote ? null : target === null ? input.password : clearPassword ? '' : input.password ? input.password : null;
        const body: AssetTargetInput = {
            ...input,
            name: input.name.trim(),
            host: remote ? input.host.trim() : '',
            port: remote ? input.port : 0,
            user: remote ? input.user.trim() : '',
            password,
            remotePath: input.remotePath.trim(),
            publicUrl: input.publicUrl.trim(),
            allowSelfSigned: input.protocol === 'ftps' && input.allowSelfSigned,
            cloudflareZoneId: input.cloudflareZoneId.trim(),
            cloudflareToken: target === null ? input.cloudflareToken : clearToken ? '' : input.cloudflareToken ? input.cloudflareToken : null,
        };

        save.mutate({ id: target?.id ?? null, input: body }, {
            onSuccess: (saved) => {
                toast(target ? `Saved ${saved.name}.` : `Added ${saved.name}.`);
                onClose();
            },
        });
    };

    return (
        <Modal open onClose={onClose} title={target ? `Edit ${target.name}` : 'Add a publish target'} className="sm:h-fit! sm:max-w-xl">
            <form
                className="flex flex-col gap-4 p-4 sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    submit();
                }}
            >
                <Field label="Name" name="target-name" value={input.name} onChange={event => set({ name: event.target.value })} placeholder="Asset host" required autoFocus />

                <Labeled label="Protocol">
                    <Segmented label="Protocol" value={input.protocol} onChange={value => set({ protocol: value as TargetProtocol })} options={PROTOCOLS} />
                </Labeled>

                {remote && (
                    <>
                        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3">
                            <Field label="Host" name="target-host" value={input.host} onChange={event => set({ host: event.target.value })} placeholder="assets.example.com" required className="w-full font-mono" />
                            <Field
                                label="Port"
                                name="target-port"
                                type="number"
                                min={0}
                                max={65535}
                                value={input.port === 0 ? '' : input.port}
                                onChange={event => set({ port: Number(event.target.value) || 0 })}
                                placeholder={String(DEFAULT_PORTS[input.protocol])}
                                className="w-full font-mono"
                            />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="User" name="target-user" value={input.user} onChange={event => set({ user: event.target.value })} autoComplete="off" className="w-full font-mono" />
                            <div className="flex flex-col gap-1.5">
                                <Field
                                    label="Password"
                                    name="target-password"
                                    type="password"
                                    autoComplete="new-password"
                                    value={input.password ?? ''}
                                    disabled={clearPassword}
                                    onChange={event => set({ password: event.target.value })}
                                    placeholder={target?.hasPassword ? 'Leave empty to keep' : ''}
                                    hint={target ? (target.hasPassword ? 'Leave empty to keep the saved one.' : 'None is saved.') : undefined}
                                />
                                {target?.hasPassword && (
                                    <Checkbox
                                        label="Clear the saved password"
                                        checked={clearPassword}
                                        onChange={(checked) => {
                                            setClearPassword(checked);
                                            set({ password: '' });
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </>
                )}

                <Field
                    label="Remote path"
                    name="target-path"
                    value={input.remotePath}
                    onChange={event => set({ remotePath: event.target.value })}
                    placeholder={remote ? '/var/www/assets' : 'D:\\www\\assets'}
                    hint={remote ? 'The folder the asset host serves from; bundled/... goes under it.' : 'A folder on this server; bundled/... goes under it.'}
                    className="w-full font-mono"
                />
                <Field
                    label="Public URL"
                    name="target-url"
                    type="url"
                    value={input.publicUrl}
                    onChange={event => set({ publicUrl: event.target.value })}
                    placeholder="https://assets.example.com"
                    hint="Where the client reaches it."
                    className="w-full font-mono"
                />

                {input.protocol === 'ftps' && (
                    <Switch
                        label="Allow a self-signed certificate"
                        hint="Only for a server you run yourself."
                        checked={input.allowSelfSigned}
                        onChange={allowSelfSigned => set({ allowSelfSigned })}
                    />
                )}

                <fieldset className="flex flex-col gap-3 border-t border-line pt-4">
                    <legend className="mb-1 text-sm font-medium">Cloudflare</legend>
                    <p className="-mt-1 text-[13px] text-muted">Optional. After each publish, Cloudflare is asked to purge exactly the addresses sent, so a file that was missing is not served from its cache as missing.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field
                            label="Zone ID"
                            name="target-cloudflare-zone"
                            value={input.cloudflareZoneId}
                            onChange={event => set({ cloudflareZoneId: event.target.value })}
                            placeholder="32 letters and digits"
                            hint="On the zone's Overview page. Needs the public URL."
                            autoComplete="off"
                            className="w-full font-mono"
                        />
                        <div className="flex flex-col gap-1.5">
                            <Field
                                label="API token"
                                name="target-cloudflare-token"
                                type="password"
                                autoComplete="new-password"
                                value={input.cloudflareToken ?? ''}
                                disabled={clearToken}
                                onChange={event => set({ cloudflareToken: event.target.value })}
                                placeholder={target?.hasCloudflareToken ? 'Leave empty to keep' : ''}
                                hint={target?.hasCloudflareToken ? 'Leave empty to keep the saved one.' : 'One allowed to purge the zone\'s cache.'}
                            />
                            {target?.hasCloudflareToken && (
                                <Checkbox
                                    label="Clear the saved token"
                                    checked={clearToken}
                                    onChange={(checked) => {
                                        setClearToken(checked);
                                        set({ cloudflareToken: '' });
                                    }}
                                />
                            )}
                        </div>
                    </div>
                </fieldset>

                {save.error && <ErrorNotice error={save.error} />}

                <div className="flex justify-end gap-2 border-t border-line pt-4">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button type="submit" icon={<Save />} disabled={save.isPending || !input.name.trim()}>{target ? 'Save' : 'Add target'}</Button>
                </div>
            </form>
        </Modal>
    );
};
