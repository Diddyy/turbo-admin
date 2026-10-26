import { useNavigate } from 'react-router';

import { useThemes } from '#/api/appearance';
import { Select } from '#/components/ui';

import { themeName, themeTree } from './themes';

/**
 * The theme picker at the top of every appearance page (XenForo's style chooser): the themes as
 * a tree under Habbo's own, going to `to(key)` for the one picked.
 */
export const ThemePicker = ({ value, to }: { value: string; to: (key: string) => string }) => {
    const { data } = useThemes();
    const navigate = useNavigate();
    const tree = data ? themeTree(data.themes, data.base) : [];

    return (
        <label className="inline-flex items-center gap-2 text-sm">
            <span className="text-muted">Theme</span>
            <Select
                aria-label="Theme"
                value={value}
                className="w-auto"
                onChange={event => void navigate(to(event.target.value))}
            >
                {data && <option value={data.base} disabled>{`${data.base} - Habbo's own (built in)`}</option>}
                {!tree.some(node => node.theme.key === value) && <option value={value}>{value}</option>}
                {tree.map(({ theme, depth }) => (
                    <option key={theme.key} value={theme.key}>{`${'  '.repeat(depth)}${themeName(theme)}${theme.state === 'loaded' ? '' : ` (${theme.state.replace('_', ' ')})`}`}</option>
                ))}
            </Select>
        </label>
    );
};
