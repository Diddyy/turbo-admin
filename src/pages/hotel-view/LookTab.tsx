import { Input, Labeled, Panel, Select } from '#/components/ui';

import type { HotelViewDraft } from './draft';
import { COMMON, toColorInput } from './model';
import { Changed } from './parts';
import { WidgetSettings } from './WidgetSettings';

const ETCHING_POSITIONS = [ 'bottom', 'top', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right' ];

/** A colour as the variables keep it: six hex digits, no #. */
const ColorField = ({ label, hint, colorKey, draft, fallback, disabled }: { label: string; hint: string; colorKey: string; draft: HotelViewDraft; fallback: string; disabled?: boolean }) => {
    const value = draft.text(colorKey);

    return (
        <Labeled label={label} hint={hint}>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value ? toColorInput(value) : fallback}
                    onChange={event => draft.setText(colorKey, event.target.value.slice(1))}
                    disabled={disabled}
                    aria-label={`${label}, picked`}
                    className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-canvas p-1 sm:h-8"
                />
                <Input value={value} onChange={event => draft.setText(colorKey, event.target.value.trim().replace(/^#/, ''))} placeholder="the client's own" className="w-40 font-mono" disabled={disabled} />
                <Changed on={draft.changed(colorKey)} />
            </div>
        </Labeled>
    );
};

/** The look every widget shares and the panes' widths. The bonus rare's picture is with its campaigns. */
export const LookTab = ({ draft, disabled }: { draft: HotelViewDraft; disabled?: boolean }) => {
    const number = (key: string, label: string, hint: string) => (
        <Labeled label={label} hint={hint}>
            <div className="flex items-center gap-2">
                <Input value={draft.text(key)} onChange={event => draft.setText(key, event.target.value.replace(/\D/g, ''))} inputMode="numeric" className="w-32" disabled={disabled} />
                <Changed on={draft.changed(key)} />
            </div>
        </Labeled>
    );

    return (
        <div className="flex flex-col gap-4">
            <Panel title="Widget text" description="Every widget's headings and words take these, so they read against the backgrounds.">
                <div className="grid gap-4 p-4 sm:grid-cols-3">
                    <ColorField label="Colour" hint="Empty is black." colorKey={COMMON.textColor} draft={draft} fallback="#000000" disabled={disabled} />
                    <ColorField label="Etching" hint="The one-pixel line beside each letter. Empty is white." colorKey={COMMON.etchingColor} draft={draft} fallback="#ffffff" disabled={disabled} />
                    <Labeled label="Etching side">
                        <div className="flex items-center gap-2">
                            <Select value={draft.text(COMMON.etchingPosition) || 'bottom'} onChange={event => draft.setText(COMMON.etchingPosition, event.target.value === 'bottom' ? '' : event.target.value)} disabled={disabled} className="w-40">
                                {ETCHING_POSITIONS.map(x => <option key={x} value={x}>{x}</option>)}
                            </Select>
                            <Changed on={draft.changed(COMMON.etchingPosition)} />
                        </div>
                    </Labeled>
                </div>
            </Panel>
            <Panel title="Columns" description="How wide the slots are: 1, 2 and 4 take the left pane's width, 3 and 5 the right's.">
                <div className="grid gap-4 p-4 sm:grid-cols-2">
                    {number(COMMON.leftPaneWidth, 'Left pane (pixels)', 'Empty is 500.')}
                    {number(COMMON.rightPaneWidth, 'Right pane (pixels)', 'Empty is 250.')}
                </div>
            </Panel>
            <WidgetSettings draft={draft} disabled={disabled} />
        </div>
    );
};
