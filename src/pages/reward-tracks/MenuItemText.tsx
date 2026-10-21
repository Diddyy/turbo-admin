import { Save } from 'lucide-react';
import { useState } from 'react';

import { useSaveText } from '#/api/content';
import { useHotelViewTexts } from '#/api/hotelView';
import { useHabboNoticeTexts } from '#/api/notices';
import { toast, toastError } from '#/components/toast';
import { Button, Input, Labeled, Panel, TextButton } from '#/components/ui';

import { INTRODUCTION, menuTextKey } from './model';

/**
 * The text of the track's item in the Progression menu (AS3 `ProgMenuController`: the item is a copy
 * of Introduction's, its text `${widget.progmenu.rewardtrack.<id>}`), saved on its own as a hotel
 * text, with Habbo's beside it when Habbo has one.
 */
export const MenuItemText = ({ id }: { id: string }) => {
    const key = menuTextKey(id);
    const { data } = useHotelViewTexts([ key ]);
    const habbo = useHabboNoticeTexts([ key ], true).data?.texts.find(x => x.key === key)?.value ?? null;
    const saved = data?.texts.find(x => x.key === key)?.value ?? '';
    const [ draft, setDraft ] = useState<string | null>(null);
    const save = useSaveText();
    const value = draft ?? saved;

    return (
        <Panel
            title="Progression menu item"
            description={(id === INTRODUCTION)
                ? 'Introduction is the menu\'s own item: it is always there, and opens this track.'
                : 'This track\'s item in the Progression menu, after Introduction and the live tracks above it in the list. It has Introduction\'s gift icon and this text, and shows how many of the track\'s prizes the player can claim.'}
            className="xl:col-span-2"
        >
            <form
                className="flex flex-wrap items-end gap-3 p-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    save.mutate({ key, value: value.trim() }, {
                        onSuccess: () => {
                            setDraft(null);
                            toast('Saved the menu item text: players see it at their next login.');
                        },
                        onError: toastError,
                    });
                }}
            >
                <Labeled
                    label="Text"
                    className="w-72"
                    hint={(
                        <>
                            Key <span className="font-mono">{key}</span>
                            {habbo !== null && (
                                <>
                                    {' '}· Habbo's: &quot;{habbo}&quot;
                                    {habbo !== value && <> <TextButton onClick={() => setDraft(habbo)}>use it</TextButton></>}
                                </>
                            )}
                        </>
                    )}
                >
                    <Input value={value} onChange={event => setDraft(event.target.value)} placeholder={habbo ?? key} aria-label="Menu item text" maxLength={64} />
                </Labeled>
                <Button type="submit" icon={<Save />} disabled={save.isPending || !value.trim() || value === saved}>Save text</Button>
            </form>
        </Panel>
    );
};
