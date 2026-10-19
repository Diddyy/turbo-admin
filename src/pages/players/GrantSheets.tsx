import { Award, Gift, PackagePlus } from 'lucide-react';
import { type FormEvent, useDeferredValue, useId, useState } from 'react';

import { useProductSuggestions } from '#/api/gamedata';
import type { PlayerDetailResponse } from '#/api/players';
import { useMe } from '#/api/queries';
import { Sheet } from '#/components/Sheet';
import { Button, Input, Labeled, Switch, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';
import { ProductIcon } from '#/pages/catalog/ProductIcon';

import type { PlayerAction } from './usePlayerAction';

interface GrantSheetProps {
    player: PlayerDetailResponse;
    action: PlayerAction;
    open: boolean;
    onClose: () => void;
}

/** What the furni or badge being named looks like, once there is a name to look up. */
const Preview = ({ type, name }: { type: 'floor' | 'badge'; name: string }) => (
    <span aria-hidden className={cx('grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-canvas sm:size-8', !name && 'border-dashed')}>
        {name && <ProductIcon type={type} name={name} className="size-7 sm:size-6" />}
    </span>
);

/**
 * Putting furniture in their inventory, or (`gift`) sending it as a present from the hotel, with a
 * note on its tag and a badge inside if wanted: the gift command sends one present at a time.
 */
export const FurnitureSheet = ({ player, action, open, onClose, canGive, canGift }: GrantSheetProps & { canGive: boolean; canGift: boolean }) => {
    const me = useMe().data;
    const listId = useId();
    const [ furni, setFurni ] = useState('');
    const [ count, setCount ] = useState('1');
    const [ asGift, setAsGift ] = useState(!canGive);
    const [ note, setNote ] = useState('');
    const [ badge, setBadge ] = useState('');
    const typed = useDeferredValue(furni.trim());
    // Class names to pick from, where you may read the product data (the catalog's or the gamedata's).
    const { data: suggestions } = useProductSuggestions(me?.canViewCatalog || me?.canViewGamedata ? typed : '');
    const className = furni.trim();
    const valid = className !== '' && (asGift ? note.trim() !== '' : Number(count) >= 1);

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (!valid)
            return;

        const done = () => {
            setNote('');
            setBadge('');
            onClose();
        };

        if (asGift)
            action.run({ action: 'gift', furni: className, note: note.trim(), badge: badge.trim() || undefined }, undefined, done);
        else
            action.run({ action: 'giveitem', furni: className, amount: Math.trunc(Number(count)) }, undefined, onClose);
    };

    return (
        <Sheet title={asGift ? `Send ${player.name} a gift` : `Add furniture for ${player.name}`} open={open} onClose={onClose}>
            <form onSubmit={submit} className="flex flex-col gap-3 px-3 py-3">
                <div className="flex items-end gap-2">
                    <Preview type="floor" name={className} />
                    <Labeled label="Class name" className="min-w-0 flex-1">
                        <Input value={furni} onChange={event => setFurni(event.target.value)} list={listId} placeholder="throne, rare_dragonlamp*4" spellCheck={false} autoComplete="off" className="font-mono" autoFocus />
                    </Labeled>
                    {!asGift && (
                        <Labeled label="How many" className="w-20 shrink-0">
                            <Input type="number" min={1} inputMode="numeric" value={count} onChange={event => setCount(event.target.value)} className="font-mono" />
                        </Labeled>
                    )}
                    <datalist id={listId}>
                        {suggestions?.map(x => <option key={x.code} value={x.code}>{x.name ?? ''}</option>)}
                    </datalist>
                </div>
                {canGive && canGift && (
                    <Switch label="Send as a gift" hint="A present with a note on its tag, opened in the client" checked={asGift} onChange={setAsGift} />
                )}
                {asGift && (
                    <>
                        <Labeled label="Note on the tag" hint="One line; the hotel caps its length (140 characters unless changed).">
                            <Textarea value={note} onChange={event => setNote(event.target.value)} rows={2} placeholder="Thanks for playing!" />
                        </Labeled>
                        <Labeled label="Badge inside" hint="Given as the present is opened; leave empty for none.">
                            <Input value={badge} onChange={event => setBadge(event.target.value)} placeholder="ADM, ACH_Login1" spellCheck={false} className="font-mono" />
                        </Labeled>
                    </>
                )}
                <Button type="submit" icon={asGift ? <Gift /> : <PackagePlus />} disabled={action.busy || !valid}>
                    {asGift ? 'Send the gift' : 'Put in inventory'}
                </Button>
            </form>
        </Sheet>
    );
};

/** Giving a badge by its code, with what the badge looks like. */
export const BadgeSheet = ({ player, action, open, onClose }: GrantSheetProps) => {
    const [ badge, setBadge ] = useState('');
    const code = badge.trim();

    return (
        <Sheet title={`Give ${player.name} a badge`} open={open} onClose={onClose}>
            <form
                onSubmit={(event) => {
                    event.preventDefault();

                    if (code !== '')
                        action.run({ action: 'givebadge', badge: code }, undefined, () => {
                            setBadge('');
                            onClose();
                        });
                }}
                className="flex flex-col gap-3 px-3 py-3"
            >
                <div className="flex items-end gap-2">
                    <Preview type="badge" name={code} />
                    <Labeled label="Badge code" className="min-w-0 flex-1">
                        <Input value={badge} onChange={event => setBadge(event.target.value)} placeholder="ADM, ACH_Login1" spellCheck={false} autoComplete="off" className="font-mono" autoFocus />
                    </Labeled>
                </div>
                <Button type="submit" icon={<Award />} disabled={action.busy || code === ''}>Give the badge</Button>
            </form>
        </Sheet>
    );
};
