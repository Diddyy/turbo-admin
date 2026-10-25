import { Package } from 'lucide-react';
import { useState } from 'react';

import { downloadPluginPackage } from '#/api/noCode';
import { Modal } from '#/components/Modal';
import { toast, toastError } from '#/components/toast';
import { Button, Input, Labeled } from '#/components/ui';

/**
 * Makes a data plugin of a theme or the hotel's own changes as this hotel has them: a zip another
 * hotel installs on its Plugins page. A theme's carries this hotel's style values as its defaults.
 */
export const PackageDialog = ({ pluginKey, open, onClose }: { pluginKey: string; open: boolean; onClose: () => void }) => {
    const [ key, setKey ] = useState(`${pluginKey === 'hotel' ? 'our' : 'my'}-${pluginKey}`);
    const [ name, setName ] = useState('');
    const [ version, setVersion ] = useState('1.0.0');
    const [ busy, setBusy ] = useState(false);

    return (
        <Modal title="Make a plugin" open={open} onClose={onClose} className="sm:h-fit! sm:max-w-lg">
            <form
                className="flex flex-col gap-3 p-4 sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    setBusy(true);
                    downloadPluginPackage(pluginKey, { key: key.trim(), name: name.trim(), version: version.trim(), author: null })
                        .then(() => {
                            toast(`${key}-${version}.zip: made.`);
                            onClose();
                        })
                        .catch(toastError)
                        .finally(() => setBusy(false));
                }}
            >
                <p className="text-sm text-muted">A data plugin with no code: install the zip on another hotel&apos;s Plugins page.</p>
                <Labeled label="Key" hint="Letters, digits, '.', '_' and '-'.">
                    <Input value={key} onChange={event => setKey(event.target.value)} className="w-full font-mono" />
                </Labeled>
                <Labeled label="Name">
                    <Input value={name} onChange={event => setName(event.target.value)} placeholder="Our theme" className="w-full" />
                </Labeled>
                <Labeled label="Version">
                    <Input value={version} onChange={event => setVersion(event.target.value)} className="w-32" />
                </Labeled>
                <div>
                    <Button type="submit" icon={<Package />} disabled={busy || !key.trim() || !name.trim() || !version.trim()}>Download the zip</Button>
                </div>
            </form>
        </Modal>
    );
};
