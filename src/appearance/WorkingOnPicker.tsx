import { FolderPen, Plus } from 'lucide-react';
import { Link } from 'react-router';

import { useThemes } from '#/api/appearance';
import { Select } from '#/components/ui';
import { themeName, themeTree } from '#/pages/appearance/themes';

import { folderOf, useWorkingOn } from './workingOn';

/**
 * "Working on: <theme>" at the top of every appearance editor: the themes as a tree, the one picked
 * is where this page's saves land. Shown with the folder so it is never a guess.
 */
export const WorkingOnPicker = () => {
    const { key, setKey } = useWorkingOn();
    const { data } = useThemes();
    const tree = data ? themeTree(data.themes, data.base) : [];

    return (
        <span className="inline-flex flex-wrap items-center gap-2 text-sm" data-working-on={key}>
            <label className="inline-flex items-center gap-2">
                <FolderPen className="size-4 text-muted" />
                <span className="text-muted">Working on</span>
                <Select aria-label="Working on" value={key} className="w-auto" onChange={event => setKey(event.target.value)}>
                    {!tree.some(node => node.theme.key === key) && <option value={key}>{themeName({ key, name: null })}</option>}
                    {tree.map(({ theme, depth }) => (
                        <option key={theme.key} value={theme.key}>{`${'  '.repeat(Math.max(0, depth - 1))}${themeName(theme)}`}</option>
                    ))}
                </Select>
            </label>
            <span className="font-mono text-xs text-muted" title="Saves on this page are written here">{folderOf(key)}</span>
            {data?.canManage && (
                <Link to="/appearance/themes?new=1" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    <Plus className="size-3.5" />
                    New theme
                </Link>
            )}
        </span>
    );
};
