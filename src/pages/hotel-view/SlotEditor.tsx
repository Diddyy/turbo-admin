import { ChevronRight } from 'lucide-react';

import { Input, Labeled, Panel, Select, Switch, TextButton } from '#/components/ui';

import type { HotelViewDraft } from './draft';
import { GenericEditor } from './GenericEditor';
import { BOTTOM_SLOT, BOTTOM_SLOT_WIDGETS, isWideSlot, SLOT_PLACES, slotKey, WIDGET_TYPES, widgetLabel } from './model';
import { Changed, ScheduleEditor } from './parts';

/** What a widget shows that is made elsewhere on the page: the view it is made on, and what it is. */
const CONTENT: Record<string, { view: string; text: string; action: string }> = {
    widgetcontainer: { view: 'promos', text: 'The promos are made under Promos and news, and each can be scheduled from there too.', action: 'Promos' },
    promoarticle: { view: 'articles', text: 'It shows the live promo articles, written under Promos and news.', action: 'Articles' },
    communitygoal: { view: 'goals', text: 'It shows the community goal playing now, set up under Campaigns.', action: 'Community goals' },
    communitygoalvsmode: { view: 'goals', text: 'It shows the two-sided community goal playing now, set up under Campaigns.', action: 'Community goals' },
    communitygoalvsmodevote: { view: 'goals', text: 'It shows the voting community goal playing now, set up under Campaigns.', action: 'Community goals' },
    bonusrare: { view: 'bonus', text: 'It shows the running bonus rare campaign, set up under Campaigns. With none running, it hides itself.', action: 'Bonus rare' },
    expiringcatalogpage: { view: 'expiring', text: 'It counts down to the catalogue page that runs out first, set under Campaigns. With none, it hides itself.', action: 'Expiring pages' },
    expiringcatalogpagesmall: { view: 'expiring', text: 'It counts down to the catalogue page that runs out first, set under Campaigns. With none, it hides itself.', action: 'Expiring pages' },
};

/** Where what the widget shows is made, and a way there. */
const ContentLine = ({ type, onOpenView }: { type: string; onOpenView: (view: string) => void }) => {
    const content = CONTENT[type];

    if (!content) return null;

    return (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            {content.text}
            <TextButton onClick={() => onOpenView(content.view)}>{content.action}<ChevronRight /></TextButton>
        </p>
    );
};

interface SlotEditorProps {
    slot: number;
    draft: HotelViewDraft;
    codes: string[];
    now: number;
    onOpenPromo: (code: string) => void;
    onOpenView: (view: string) => void;
    disabled?: boolean;
}

/** One of the five slots: what it holds, and for a promo slot the schedule of promos it shows. */
const MainSlotEditor = ({ slot, draft, codes, now, onOpenPromo, onOpenView, disabled }: SlotEditorProps) => {
    const widgetKey = slotKey(slot, 'widget');
    const type = draft.text(widgetKey);

    return (
        <Panel
            title={<span className="flex items-center gap-2">Slot {slot} <span className="font-normal text-muted">{SLOT_PLACES[slot]}</span> <Changed on={[ 'widget', 'conf', 'layout', 'separator', 'title', 'ignore' ].some(x => draft.changed(slotKey(slot, x as 'widget')))} /></span>}
            description={type ? widgetLabel(type) : 'Empty'}
        >
            <div className="flex flex-col gap-5 p-4">
                <div className="flex flex-col gap-2">
                    <Labeled label="Holds" hint={type && !WIDGET_TYPES.find(x => x.value === type)?.drawn ? 'Nitro doesn\'t draw this widget yet: players see the slot empty.' : undefined} className="sm:max-w-96">
                        <Select value={type} onChange={event => draft.setText(widgetKey, event.target.value)} disabled={disabled}>
                            <option value="">Nothing</option>
                            {WIDGET_TYPES.map(x => <option key={x.value} value={x.value}>{x.label}{x.drawn ? '' : ' (not drawn yet)'}</option>)}
                            {type && !WIDGET_TYPES.some(x => x.value === type) && <option value={type}>{type}</option>}
                        </Select>
                    </Labeled>
                    <ContentLine type={type} onOpenView={onOpenView} />
                </div>
                {type === 'widgetcontainer' && (
                    <Labeled label="Promos it shows, by time" hint="From each time on, the promo with that code shows, until the next starts.">
                        <ScheduleEditor
                            value={draft.text(slotKey(slot, 'conf'))}
                            onChange={value => draft.setText(slotKey(slot, 'conf'), value)}
                            codes={codes}
                            now={now}
                            emptyLabel="the slot is empty"
                            onOpen={onOpenPromo}
                            disabled={disabled}
                        />
                    </Labeled>
                )}
                {type === 'generic' && (
                    <GenericEditor confKey={slotKey(slot, 'conf')} layoutKey={slotKey(slot, 'layout')} draft={draft} wide={isWideSlot(slot)} textPrefix={`landing.view.dynamic.slot.${slot}.`} disabled={disabled} />
                )}
                {(slot === 4 || slot === 5) && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Switch label="A heading above it" checked={draft.bool(slotKey(slot, 'separator'))} onChange={checked => draft.setBool(slotKey(slot, 'separator'), checked)} disabled={disabled} />
                        {draft.bool(slotKey(slot, 'separator')) && (
                            <Labeled label="Heading (text key)">
                                <Input value={draft.text(slotKey(slot, 'title'))} onChange={event => draft.setText(slotKey(slot, 'title'), event.target.value)} className="w-full font-mono text-xs" disabled={disabled} />
                            </Labeled>
                        )}
                    </div>
                )}
                {slot === 5 && (
                    <Switch
                        label="Don't line up slots 2 and 3"
                        hint="Normally the top row's two slots are made as tall as each other."
                        checked={draft.bool(slotKey(5, 'ignore'))}
                        onChange={checked => draft.setBool(slotKey(5, 'ignore'), checked)}
                        disabled={disabled}
                    />
                )}
            </div>
        </Panel>
    );
};

/**
 * The bottom slot: the default layout's placeholder near the window's foot, beside the avatar. It
 * takes only the layout's fixed widgets - the expiring catalogue page, the community goal and the
 * next limited rare - never a promo or a schedule.
 */
const BottomSlotEditor = ({ draft, onOpenView, disabled }: SlotEditorProps) => {
    const key = slotKey(BOTTOM_SLOT, 'widget');
    const type = draft.text(key);

    return (
        <Panel
            title={<span className="flex items-center gap-2">Slot {BOTTOM_SLOT} <span className="font-normal text-muted">{SLOT_PLACES[BOTTOM_SLOT]}</span> <Changed on={draft.changed(key)} /></span>}
            description="Only the layout's fixed widgets go here."
        >
            <div className="flex flex-col gap-2 p-4">
                <Labeled label="Holds" className="sm:max-w-96">
                    <Select value={type} onChange={event => draft.setText(key, event.target.value)} disabled={disabled}>
                        <option value="">Nothing</option>
                        {BOTTOM_SLOT_WIDGETS.map(x => <option key={x} value={x}>{widgetLabel(x)}</option>)}
                        {type && !(BOTTOM_SLOT_WIDGETS as readonly string[]).includes(type) && <option value={type}>{widgetLabel(type)} (not drawn here)</option>}
                    </Select>
                </Labeled>
                <ContentLine type={type} onOpenView={onOpenView} />
            </div>
        </Panel>
    );
};

/** A slot of the reception, the five widget slots and the bottom one alike. */
export const SlotEditor = (props: SlotEditorProps) => (props.slot === BOTTOM_SLOT ? <BottomSlotEditor {...props} /> : <MainSlotEditor {...props} />);
