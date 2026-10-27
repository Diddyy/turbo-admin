import { useTextSearch } from '#/api/gamedata';
import { useThemeTexts } from '#/api/noCode';
import { Input, Labeled } from '#/components/ui';

import { useStudio } from '../studio';

/** One text the element shows, edited in place: what players read, by its key; unsaved until the studio's Save. */
const TextField = ({ textKey, shown }: { textKey: string; shown: string | undefined }) => {
    const studio = useStudio();
    const { data } = useTextSearch(textKey, 0);
    const entry = data?.items.find(item => item.key === textKey);
    const theme = useThemeTexts(studio.theme, studio.intoTheme).data?.texts;
    // Staff changed the hotel's text (it isn't Habbo's): the hotel's wins over any theme's.
    const staffs = !!entry && (entry.value !== entry.habbo);
    // What players read now: the theme's own text (working on one), else the hotel's, else what the client shows.
    const saved = (studio.intoTheme ? theme?.[textKey] : undefined) ?? entry?.value ?? shown;
    const draft = studio.text(textKey);

    return (
        <Labeled label="Text" hint={<>What players read here, in every window showing it (<span className="font-mono">{textKey}</span>).</>}>
            <Input
                aria-label={`Text ${textKey}`}
                value={draft ?? saved ?? ''}
                placeholder={textKey}
                disabled={!studio.canManage}
                onChange={event => studio.setText(textKey, event.target.value === saved ? undefined : event.target.value, `text:${textKey}`)}
            />
            {studio.intoTheme && staffs && <span className="text-xs text-warn">Staff changed this text on Gamedata &gt; Texts: players see the hotel's, not the theme's.</span>}
        </Labeled>
    );
};

interface TextFieldsProps {
    /** The text keys the element shows. */
    keys: string[];
    /** What the client shows now for each key. */
    shown: Record<string, string>;
    /** The caption the draft sets on the element; its own when none. */
    caption: string | undefined;
    ownCaption: string | null | undefined;
    onCaption: (value: string | undefined) => void;
}

/** What the element says, edited where it is: each text it shows by key, or its caption when it shows none by key. */
export const TextFields = ({ keys, shown, caption, ownCaption, onCaption }: TextFieldsProps) => {
    if (keys.length) return <>{keys.map(key => <TextField key={key} textKey={key} shown={shown[key]} />)}</>;

    if (!ownCaption && caption === undefined) return null;

    return (
        <Labeled label="Caption">
            <Input aria-label="Caption" value={caption ?? ''} placeholder={ownCaption ?? ''} onChange={event => onCaption(event.target.value === '' ? undefined : event.target.value)} />
        </Labeled>
    );
};
