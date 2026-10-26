import { Eye, Star, Users } from 'lucide-react';
import { useState } from 'react';

import { type ThemeAudience, type ThemeAudienceChange, type ThemeStatus, useSetThemeAudience, useThemeAudiences } from '#/api/appearance';
import { useClientAssets } from '#/api/assets';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, Checkbox, Input, Select } from '#/components/ui';

const STATUS_LABEL: Record<ThemeStatus, string> = { live: 'Live', development: 'In development', off: 'Off' };

// A theme no one set (one just made or installed) is in development: no player gets it until it is set Live.

/** The client page staff open a theme in for one load: the preview host's page without `?preview`, with `?theme=`. */
const previewLink = (preview: string | undefined, key: string) => {
    if (!preview) return null;

    try {
        const url = new URL(preview);

        url.searchParams.delete('preview');
        url.searchParams.set('theme', key);

        return url.toString();
    } catch {
        return null;
    }
};

/** A comma separated list as its trimmed entries. */
const listOf = (text: string) => text.split(',').map(x => x.trim()).filter(x => x.length > 0);

/**
 * Who gets a theme (XenForo's style options): Live / In development / Off, the hotel's default, whether
 * players may choose it, and while in development the players and permission groups that get it; and
 * a "Preview as" link that opens the client drawing it once, for staff who may preview themes.
 */
export const ThemeAudienceControls = ({ themeKey }: { themeKey: string }) => {
    const { data } = useThemeAudiences();
    const assets = useClientAssets();
    const theme = data?.themes.find(x => x.key === themeKey);

    if (!data || !theme) return null;

    const link = previewLink(assets?.preview, theme.key);

    return (
        <span className="flex flex-wrap items-center gap-2" data-theme-audience={theme.key}>
            {theme.isDefault && <Badge tone="green"><Star className="mr-1 inline size-3" />default</Badge>}
            {theme.status !== 'live' && <Badge tone={theme.status === 'development' ? 'amber' : 'neutral'}>{STATUS_LABEL[theme.status]}</Badge>}
            {theme.selectable && <Badge>players may choose</Badge>}
            {theme.status === 'development' && (
                <span className="text-xs text-muted">
                    <Users className="mr-1 inline size-3" />
                    {[ ...theme.players.map(x => x.name ?? `#${x.id}`), ...theme.groups.map(x => `group ${x}`) ].join(', ') || 'no audience yet'}
                </span>
            )}
            {link && theme.status !== 'off' && (
                <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2 text-sm text-accent hover:underline">
                    <Eye className="size-4" />
                    Preview as this theme
                </a>
            )}
            {data.canManage && <ThemeAudienceEditor theme={theme} groups={data.groups} />}
        </span>
    );
};

const ThemeAudienceEditor = ({ theme, groups }: { theme: ThemeAudience; groups: string[] }) => {
    const [ open, setOpen ] = useState(false);
    const [ players, setPlayers ] = useState('');
    const [ chosenGroups, setChosenGroups ] = useState<string[]>([]);
    const set = useSetThemeAudience();

    const save = (change: ThemeAudienceChange, said: string) => set.mutate({ key: theme.key, change }, { onSuccess: () => toast(said), onError: toastError });

    const start = () => {
        setPlayers(theme.players.map(x => x.name ?? String(x.id)).join(', '));
        setChosenGroups(theme.groups);
        setOpen(true);
    };

    if (!open) return <Button variant="ghost" onClick={start}>Who gets it</Button>;

    return (
        <span className="flex w-full flex-col gap-2 rounded-lg border border-line p-3" data-theme-editor={theme.key}>
            <span className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                    Status
                    <Select
                        aria-label="Status"
                        value={theme.status}
                        disabled={theme.key === 'hotel'}
                        title={theme.key === 'hotel' ? 'The hotel\'s own theme is always Live: every theme ends in it' : undefined}
                        onChange={event => save({ status: event.target.value as ThemeStatus }, `${theme.key} is ${STATUS_LABEL[event.target.value as ThemeStatus]} - players see it from their next load`)}
                    >
                        {(Object.keys(STATUS_LABEL) as ThemeStatus[]).map(status => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
                    </Select>
                </label>
                <Checkbox
                    label="Players may choose it"
                    checked={theme.selectable}
                    onChange={checked => save({ selectable: checked }, checked ? `Players may choose ${theme.key}` : `${theme.key} can no longer be chosen`)}
                />
                <Button
                    variant="ghost"
                    icon={<Star />}
                    disabled={theme.isDefault || theme.status !== 'live'}
                    title={theme.status !== 'live' ? 'Only a Live theme can be the default' : undefined}
                    onClick={() => save({ isDefault: true }, `${theme.key} is the hotel's default - every player without a theme of their own draws it from their next load`)}
                >
                    Make default
                </Button>
            </span>
            <span className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm">
                    Players who get it while in development (names, comma separated)
                    <Input aria-label="Audience players" value={players} onChange={event => setPlayers(event.target.value)} placeholder="Name, Another name" />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                    Permission groups
                    <Select
                        aria-label="Audience groups"
                        multiple
                        value={chosenGroups}
                        onChange={event => setChosenGroups([ ...event.target.selectedOptions ].map(x => x.value))}
                        className="h-24"
                    >
                        {groups.map(group => <option key={group} value={group}>{group}</option>)}
                    </Select>
                </label>
                <Button onClick={() => save({ players: listOf(players), groups: chosenGroups }, `Saved who gets ${theme.key}`)}>Save audience</Button>
                <Button variant="ghost" onClick={() => setOpen(false)}>Close</Button>
            </span>
            <span className="text-xs text-muted">
                Staff with appearance.themes.preview may draw any theme in development (the client&apos;s Other settings, or Preview as). Players see a change from their next load.
            </span>
        </span>
    );
};
