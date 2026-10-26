import { Palette } from 'lucide-react';
import { useState } from 'react';

import { useThemes } from '#/api/appearance';
import { useCreateTheme } from '#/api/noCode';
import { folderOf, useWorkingOn } from '#/appearance/workingOn';
import { Modal } from '#/components/Modal';
import { toast } from '#/components/toast';
import { Button, ErrorNotice, Input, Labeled, Select } from '#/components/ui';

import { themeName, themeTree } from './themes';

/** A key the plugin folder takes, from a name: `Night Club` -> `night-club`. */
const keyOf = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[^a-z0-9]+|-+$/g, '').slice(0, 64);

/**
 * A new theme (XenForo's "Add style"): a name, its key, and the theme it starts from - Habbo's own,
 * this hotel's, or any installed theme - which it extends; or, with `copyOf`, a copy of that theme as
 * this hotel has it. Made as a data plugin of its own, and worked on from then on: every appearance
 * editor's saves land in its folder.
 */
export const NewThemeDialog = ({ open, copyOf, onClose }: { open: boolean; copyOf: string | null; onClose: () => void }) => {
    const { data } = useThemes();
    const create = useCreateTheme();
    const { setKey } = useWorkingOn();
    const [ name, setName ] = useState('');
    const [ key, setThemeKey ] = useState('');
    const [ extendsKey, setExtends ] = useState('habbo');
    const tree = data ? themeTree(data.themes, data.base) : [];
    const source = copyOf ? data?.themes.find(theme => theme.key === copyOf) : undefined;
    const typedKey = key || keyOf(name);

    return (
        <Modal title={source ? `Duplicate ${themeName(source)}` : 'New theme'} open={open} onClose={onClose} className="sm:h-fit! sm:max-w-lg">
            <form
                className="flex flex-col gap-3 p-4 sm:p-5"
                onSubmit={(event) => {
                    event.preventDefault();
                    create.mutate(
                        { key: typedKey, name: name.trim(), extends: copyOf ? null : extendsKey, copyOf, author: null },
                        { onSuccess: (theme) => {
                            setKey(theme.key);
                            toast(`${name.trim()} made: you are working on it, so your edits land in ${folderOf(theme.key)}.`);
                            setName('');
                            setThemeKey('');
                            onClose();
                        } },
                    );
                }}
            >
                <p className="text-sm text-muted">
                    {source
                        ? `A copy of ${themeName(source)} as this hotel has it: its patches, images and style values, under a new key.`
                        : 'A theme of its own: it starts as the theme it extends, and holds only what you change.'}
                </p>
                <Labeled label="Name">
                    <Input value={name} onChange={event => setName(event.target.value)} placeholder="Night club" className="w-full" autoFocus />
                </Labeled>
                <Labeled label="Key" hint={`Letters, digits, '.', '_' and '-'. Its files: ${folderOf(typedKey || '<key>')}`}>
                    <Input value={typedKey} onChange={event => setThemeKey(event.target.value)} className="w-full font-mono" />
                </Labeled>
                {!copyOf && (
                    <Labeled label="Starts from" hint="It extends this theme: everything it does not change is the parent's.">
                        <Select aria-label="Starts from" value={extendsKey} onChange={event => setExtends(event.target.value)} className="w-full">
                            <option value={data?.base ?? 'habbo'}>Habbo&apos;s own (built in)</option>
                            {tree.map(({ theme, depth }) => (
                                <option key={theme.key} value={theme.key}>{`${'  '.repeat(Math.max(0, depth - 1))}${themeName(theme)}`}</option>
                            ))}
                        </Select>
                    </Labeled>
                )}
                {create.error && <ErrorNotice error={create.error} />}
                <div>
                    <Button type="submit" icon={<Palette />} disabled={create.isPending || !typedKey || !name.trim()}>
                        {create.isPending ? 'Making it...' : source ? 'Duplicate' : 'Make the theme'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
};
