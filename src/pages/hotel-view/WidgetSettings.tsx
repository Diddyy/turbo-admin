import type { ImageAccept } from '#/api/media';
import { Input, Labeled, Panel, Switch } from '#/components/ui';

import type { HotelViewDraft } from './draft';
import { useResolveImage } from './hooks';
import { CATALOG_PROMO_TEXTS, LIBRARY_ADDRESS, WIDGET_SETTINGS } from './model';
import { Changed, ImageField } from './parts';

const CATALOG_PROMO_IMAGE: ImageAccept = { ...LIBRARY_ADDRESS, usedIn: 'hotelView.catalogPromo' };
const ROOM_HOPPER_IMAGE: ImageAccept = { ...LIBRARY_ADDRESS, usedIn: 'hotelView.roomHopper' };

/** A variable as one line of text, with a mark when it has changed. */
const TextSetting = ({ label, hint, settingKey, draft, disabled, mono }: { label: string; hint?: string; settingKey: string; draft: HotelViewDraft; disabled?: boolean; mono?: boolean }) => (
    <Labeled label={label} hint={hint}>
        <div className="flex items-center gap-2">
            <Input value={draft.text(settingKey)} onChange={event => draft.setText(settingKey, event.target.value)} className={mono ? 'w-full font-mono text-xs' : 'w-full'} disabled={disabled} />
            <Changed on={draft.changed(settingKey)} />
        </div>
    </Labeled>
);

/**
 * What the reception's fixed widgets read besides their slot: whether the next limited rare asks
 * at all, the community goal's catalogue button, and the catalogue promo's and room hopper's
 * targets, pictures and words.
 */
export const WidgetSettings = ({ draft, disabled }: { draft: HotelViewDraft; disabled?: boolean }) => {
    const resolve = useResolveImage(draft);

    return (
        <>
            <Panel title="Next limited rare" description="Counts down to the next limited series on sale, from the catalogue's limited section.">
                <div className="p-4 sm:max-w-md">
                    <Switch
                        label="Turned off"
                        hint="The widget asks nothing and shows nothing (next.limited.rare.countdown.widget.disabled)."
                        checked={draft.bool(WIDGET_SETTINGS.nextLimitedRareDisabled)}
                        onChange={checked => draft.setBool(WIDGET_SETTINGS.nextLimitedRareDisabled, checked)}
                        disabled={disabled}
                    />
                </div>
            </Panel>
            <Panel title="Community goal" description="The goal itself, its words and its standing are on the Community goals tab; its meter art is the image library's reception/meter_level_<0-3>_<goal>.png.">
                <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <Switch
                        label="Catalogue button"
                        hint="Shows the button that opens the page below."
                        checked={draft.bool(WIDGET_SETTINGS.communityInteractive)}
                        onChange={checked => draft.setBool(WIDGET_SETTINGS.communityInteractive, checked)}
                        disabled={disabled}
                    />
                    <TextSetting label="The page it opens" hint="A catalogue page's name." settingKey={WIDGET_SETTINGS.communityCatalogTarget} draft={draft} disabled={disabled} mono />
                </div>
            </Panel>
            <Panel title="Catalogue promo" description="Nitro doesn't draw this widget yet; set it up for when it does.">
                <div className="flex flex-col gap-3 p-4">
                    <TextSetting label="The page it opens" hint="A catalogue page's name." settingKey={WIDGET_SETTINGS.catalogPromoTarget} draft={draft} disabled={disabled} mono />
                    <ImageField label="Picture" value={draft.text(WIDGET_SETTINGS.catalogPromoImage)} onChange={value => draft.setText(WIDGET_SETTINGS.catalogPromoImage, value)} accept={CATALOG_PROMO_IMAGE} resolve={resolve} changed={draft.changed(WIDGET_SETTINGS.catalogPromoImage)} disabled={disabled} />
                    <div className="grid gap-3 sm:grid-cols-2">
                        {CATALOG_PROMO_TEXTS.map(text => (
                            <Labeled key={text.key} label={text.label} hint={text.key}>
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={draft.phrase(text.key) ?? ''}
                                        onChange={event => draft.setPhrase(text.key, event.target.value === '' && draft.phrase(text.key) === undefined ? null : event.target.value)}
                                        className="w-full"
                                        disabled={disabled}
                                    />
                                    <Changed on={draft.phraseChanged(text.key)} />
                                </div>
                            </Labeled>
                        ))}
                    </div>
                </div>
            </Panel>
            <Panel title="Room hopper" description="Nitro doesn't draw this widget yet; set it up for when it does.">
                <div className="flex flex-col gap-3 p-4">
                    <TextSetting label="Network" hint="The room network's id the widget sends players into." settingKey={WIDGET_SETTINGS.roomHopperNetwork} draft={draft} disabled={disabled} mono />
                    <ImageField label="Picture" value={draft.text(WIDGET_SETTINGS.roomHopperImage)} onChange={value => draft.setText(WIDGET_SETTINGS.roomHopperImage, value)} accept={ROOM_HOPPER_IMAGE} resolve={resolve} changed={draft.changed(WIDGET_SETTINGS.roomHopperImage)} disabled={disabled} />
                </div>
            </Panel>
        </>
    );
};
