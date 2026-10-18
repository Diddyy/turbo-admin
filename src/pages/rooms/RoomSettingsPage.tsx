import { Minus, Plus, Save } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { useParams } from 'react-router';

import { useRoom } from '#/api/queries';
import { roomCalls, useRoomAction, useRoomCategories } from '#/api/rooms';
import type { RoomDetailResponse, RoomSettingsRequest } from '#/api/types';
import { Button, ErrorNotice, Field, IconButton, Input, Label, Labeled, Loading, PageBody, Panel, Segmented, Select, Switch, Textarea, WarningNotice } from '#/components/ui';
import { cx } from '#/lib/cx';

import { CHAT_FLOOD_OPTIONS, DOOR_MODE_OPTIONS, THICKNESS_OPTIONS, TRADE_MODE_OPTIONS, WHO_OPTIONS } from './labels';
import { ActionOutcome, RoomHeader } from './RoomHeader';

/** The room's settings as the form starts them: as saved, the password left empty to keep it. */
const settingsOf = (room: RoomDetailResponse): RoomSettingsRequest => ({
    name: room.name,
    description: room.description,
    doorMode: room.doorMode,
    password: '',
    maxPlayers: room.playersMax,
    categoryId: room.categoryId,
    tags: room.tags,
    tradeMode: room.tradeMode,
    allowPets: room.allowPets,
    allowPetsEat: room.allowPetsEat,
    allowWalkThrough: room.allowWalkThrough,
    hideWalls: room.hideWalls,
    wallThickness: room.wallThickness,
    floorThickness: room.floorThickness,
    whoCanMute: room.whoCanMute,
    whoCanKick: room.whoCanKick,
    whoCanBan: room.whoCanBan,
    chatFloodProtection: room.chatFloodProtection,
    leaveOnDoorTile: room.leaveOnDoorTile,
    idleSleepEnabled: room.idleSleepEnabled,
    idleSleepTimeoutSeconds: room.idleSleepTimeoutSeconds,
    idleAutokickEnabled: room.idleAutokickEnabled,
    idleAutokickTimeoutSeconds: room.idleAutokickTimeoutSeconds,
    muteAllPets: room.muteAllPets,
});

const tagsOf = (text: string) => text.split(',').map(x => x.trim()).filter(x => x !== '');

/** How many settings differ from what is saved: what the save bar counts. */
const changesBetween = (saved: RoomSettingsRequest, next: RoomSettingsRequest) =>
    (Object.keys(saved) as (keyof RoomSettingsRequest)[]).filter(key =>
        key === 'tags'
            ? saved.tags.join(',') !== next.tags.join(',')
            : key === 'password'
                ? next.password !== ''
                : saved[key] !== next[key]).length;

/** A group of settings: its title in the mono label face, its controls under it. */
const Section = ({ title, hint, children, className }: { title: string; hint?: ReactNode; children: ReactNode; className?: string }) => (
    <Panel className={className}>
        <div className="flex flex-col gap-1 px-4 pt-4 pb-1">
            <Label>{title}</Label>
            {hint && <span className="text-xs text-muted">{hint}</span>}
        </div>
        <div className="flex flex-col gap-4 px-4 pt-2 pb-4">{children}</div>
    </Panel>
);

/** A number nudged up and down with buttons a thumb can hit, or typed. */
const Stepper = ({ label, value, onChange, min = 1 }: { label: string; value: number; onChange: (value: number) => void; min?: number }) => (
    <div className="flex items-center justify-between gap-4">
        <span className="text-sm">{label}</span>
        <div className="flex items-center gap-1">
            <IconButton label={`Fewer: ${label}`} icon={<Minus />} className="border-line bg-subtle" onClick={() => onChange(Math.max(min, value - 1))} />
            <Input
                type="number"
                min={min}
                value={value}
                onChange={event => onChange(Number(event.target.value))}
                aria-label={label}
                className="w-16 text-center font-mono"
            />
            <IconButton label={`More: ${label}`} icon={<Plus />} className="border-line bg-subtle" onClick={() => onChange(value + 1)} />
        </div>
    </div>
);

const FORM_ID = 'room-settings';

const SettingsForm = ({ room }: { room: RoomDetailResponse }) => {
    const categories = useRoomCategories();
    const save = useRoomAction(room.id);
    const [ settings, setSettings ] = useState(() => settingsOf(room));
    const [ tags, setTags ] = useState(room.tags.join(', '));
    const next = { ...settings, tags: tagsOf(tags) };
    const changes = changesBetween(settingsOf(room), next);

    const set = <K extends keyof RoomSettingsRequest>(key: K, value: RoomSettingsRequest[K]) =>
        setSettings(previous => ({ ...previous, [key]: value }));

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        save.mutate(() => roomCalls(room.id).saveSettings(next), {
            // A typed password is spent once saved: the box goes back to "keep it".
            onSuccess: () => set('password', ''),
        });
    };

    return (
        <form id={FORM_ID} onSubmit={handleSubmit} className="flex flex-col gap-4 lg:gap-5">
            <ActionOutcome message={save.data?.message} error={save.error} />
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-5">
                <div className="flex flex-col gap-4 lg:gap-5">
                    <Section title="Basics">
                        <Field label="Name" name="name" value={settings.name} onChange={event => set('name', event.target.value)} required />
                        <Labeled label="Description">
                            <Textarea value={settings.description} onChange={event => set('description', event.target.value)} rows={2} />
                        </Labeled>
                        <Labeled label="Category" hint="Staff may use any category, staff-only ones included.">
                            <Select
                                value={settings.categoryId ?? ''}
                                onChange={event => set('categoryId', event.target.value === '' ? null : Number(event.target.value))}
                            >
                                <option value="">None</option>
                                {categories.data?.map(category => (
                                    <option key={category.id} value={category.id}>
                                        {category.name}
                                        {category.staffOnly ? ' (staff)' : ''}
                                        {category.visible ? '' : ' (hidden)'}
                                    </option>
                                ))}
                            </Select>
                        </Labeled>
                        <Field label="Tags" name="tags" value={tags} onChange={event => setTags(event.target.value)} hint="Separated by commas. The room keeps as many as the hotel allows." />
                    </Section>

                    <Section title="Access">
                        <Labeled label="Door">
                            <Segmented label="Door" value={settings.doorMode} onChange={value => set('doorMode', value)} options={DOOR_MODE_OPTIONS} />
                        </Labeled>
                        {settings.doorMode === 'Password' && (
                            <Field
                                label="Password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                value={settings.password}
                                onChange={event => set('password', event.target.value)}
                                placeholder={room.hasPassword ? 'Leave empty to keep the current one' : ''}
                                required={!room.hasPassword}
                            />
                        )}
                        <Stepper label="Maximum players" value={settings.maxPlayers} onChange={value => set('maxPlayers', value)} />
                        <Labeled label="Trading">
                            <Segmented label="Trading" value={settings.tradeMode} onChange={value => set('tradeMode', value)} options={TRADE_MODE_OPTIONS} />
                        </Labeled>
                    </Section>
                </div>

                <div className="flex flex-col gap-4 lg:gap-5">
                    <Section title="Moderation">
                        <div className="grid gap-4 sm:grid-cols-3">
                            <Labeled label="Who can mute">
                                <Select value={settings.whoCanMute} onChange={event => set('whoCanMute', event.target.value)}>{WHO_OPTIONS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</Select>
                            </Labeled>
                            <Labeled label="Who can kick">
                                <Select value={settings.whoCanKick} onChange={event => set('whoCanKick', event.target.value)}>{WHO_OPTIONS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</Select>
                            </Labeled>
                            <Labeled label="Who can ban">
                                <Select value={settings.whoCanBan} onChange={event => set('whoCanBan', event.target.value)}>{WHO_OPTIONS.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</Select>
                            </Labeled>
                        </div>
                        <Labeled label="Chat flood protection">
                            <Segmented label="Chat flood protection" value={settings.chatFloodProtection} onChange={value => set('chatFloodProtection', value)} options={CHAT_FLOOD_OPTIONS} />
                        </Labeled>
                    </Section>

                    <Section title="The room">
                        <div className="-my-2 divide-y divide-line">
                            <Switch label="Pets allowed" checked={settings.allowPets} onChange={value => set('allowPets', value)} />
                            <Switch label="Others may feed pets" checked={settings.allowPetsEat} onChange={value => set('allowPetsEat', value)} />
                            <Switch label="Mute all pets" checked={settings.muteAllPets} onChange={value => set('muteAllPets', value)} />
                            <Switch label="Walk through others" checked={settings.allowWalkThrough} onChange={value => set('allowWalkThrough', value)} />
                            <Switch label="Leave by stepping on the door tile" checked={settings.leaveOnDoorTile} onChange={value => set('leaveOnDoorTile', value)} />
                            <Switch label="Hide walls" checked={settings.hideWalls} onChange={value => set('hideWalls', value)} />
                        </div>
                        <Labeled label="Wall thickness">
                            <Segmented label="Wall thickness" value={settings.wallThickness} onChange={value => set('wallThickness', value)} options={THICKNESS_OPTIONS} />
                        </Labeled>
                        <Labeled label="Floor thickness">
                            <Segmented label="Floor thickness" value={settings.floorThickness} onChange={value => set('floorThickness', value)} options={THICKNESS_OPTIONS} />
                        </Labeled>
                    </Section>

                    <Section title="Idle players" hint="The room keeps the times within the hotel's limits.">
                        <div className="flex flex-col gap-2">
                            <Switch label="Fall asleep when idle" checked={settings.idleSleepEnabled} onChange={value => set('idleSleepEnabled', value)} />
                            <Field
                                label="Seconds before falling asleep"
                                name="idle-sleep"
                                type="number"
                                min={0}
                                value={settings.idleSleepTimeoutSeconds}
                                onChange={event => set('idleSleepTimeoutSeconds', Number(event.target.value))}
                                disabled={!settings.idleSleepEnabled}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Switch label="Sent out when idle" checked={settings.idleAutokickEnabled} onChange={value => set('idleAutokickEnabled', value)} />
                            <Field
                                label="Seconds before being sent out"
                                name="idle-kick"
                                type="number"
                                min={0}
                                value={settings.idleAutokickTimeoutSeconds}
                                onChange={event => set('idleAutokickTimeoutSeconds', Number(event.target.value))}
                                disabled={!settings.idleAutokickEnabled}
                            />
                        </div>
                    </Section>
                </div>
            </div>

            {/* At the foot of the window while there is more page below it: never scrolled away from. */}
            <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-xl border border-line bg-chrome/95 px-4 py-3 shadow-2xl backdrop-blur lg:bottom-4">
                <span className="min-w-0 flex-1 text-[13px] text-muted">
                    <span aria-hidden className={cx('mr-2', changes > 0 ? 'text-warn' : 'text-good')}>●</span>
                    {changes === 0 ? 'No unsaved changes' : changes === 1 ? '1 unsaved change' : `${changes} unsaved changes`}
                </span>
                <Button type="submit" icon={<Save />} disabled={changes === 0 || save.isPending}>Save</Button>
            </div>
        </form>
    );
};

/**
 * A room's settings, all of them, as its owner's settings dialog has them: saved through the room
 * itself, which keeps them within the hotel's limits and tells everyone inside at once.
 */
export const RoomSettingsPage = () => {
    const id = Number(useParams().id);
    const { data: room, error, isPending } = useRoom(id);

    return (
        <>
            <RoomHeader id={id} room={room} tab="settings" />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {isPending && <Loading />}
                {error && <ErrorNotice error={error} />}
                {room && !room.can.editSettings && (
                    <WarningNotice>Changing a room&apos;s settings needs owning it, or room.control.any.</WarningNotice>
                )}
                {/* Keyed by the room, so the form starts again from what another page saved. */}
                {room?.can.editSettings && <SettingsForm key={room.id} room={room} />}
            </PageBody>
        </>
    );
};
