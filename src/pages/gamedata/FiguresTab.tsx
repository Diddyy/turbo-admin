import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { FILES, type GamedataStatus, useFigureImport, useFigureImportPreview, useGrantClothing, useOwnedClothing } from '#/api/gamedata';
import { Badge, Button, ErrorNotice, Input, Labeled, Panel, Segmented, SuccessNotice } from '#/components/ui';
import { BundleList } from '#/pages/assets/BundleList';
import { BundleUpdate } from '#/pages/assets/BundleUpdate';

import { ClothingEditor } from './ClothingEditor';
import { PaletteEditor } from './PaletteEditor';
import { FieldChanges, HabboUpdate, ReviewItem } from './parts';

const KIND_NAMES: Record<number, string> = { 0: 'colour', 1: 'kind', 2: 'piece' };

const VIEWS = [
    { value: 'clothing', label: 'Clothing' },
    { value: 'colours', label: 'Colours' },
    { value: 'bundles', label: 'Bundles' },
];

/** Habbo's newest figure data: what taking it in would change. */
export const HabboFigures = ({ status, defaultOpen }: { status: GamedataStatus; defaultOpen?: boolean }) => {
    const version = status.latestFigures;
    const { data: preview, error } = useFigureImportPreview(version !== null);
    const take = useFigureImport();

    return (
        <HabboUpdate
            defaultOpen={defaultOpen}
            title="figure data"
            version={version && { name: version.hash.slice(0, 10), holds: `${version.setCount.toLocaleString()} pieces, ${version.colorCount.toLocaleString()} colours`, foundAt: version.foundAt, importedAt: version.importedAt }}
            preview={preview && { ...preview, listed: preview.items.length }}
            error={error}
            file={FILES.figureData}
            canManage={status.canManage}
            canTake={!!preview && preview.added + preview.updated + preview.kept > 0}
            confirm={preview ? { title: 'Take in Habbo\'s figure data?', body: `${preview.added} records are added and ${preview.updated} updated. It runs in the background and can be rolled back from the history.` } : { title: '' }}
            onTake={() => preview && take.mutate(preview.version.id)}
            taking={take.isPending}
            takeError={take.error}
        >
            {preview?.items.map(item => (
                <ReviewItem key={`${item.kind}:${item.key}`} action={item.action} name={item.key} kind={KIND_NAMES[item.kind]}>
                    {item.action === 0 ? <span className="text-xs text-muted">new</span> : <FieldChanges fields={item.fields} />}
                </ReviewItem>
            ))}
        </HabboUpdate>
    );
};

/** The sold pieces a player owns: what lets them wear a piece marked as sold. */
const PlayerClothing = () => {
    const [ player, setPlayer ] = useState('');
    const [ sets, setSets ] = useState('');
    const playerId = Number(player) > 0 ? Number(player) : null;
    const { data: owned, error } = useOwnedClothing(playerId);
    const grant = useGrantClothing();
    const setIds = sets.trim() === '' ? [] : sets.split(/[\s,]+/).map(Number).filter(x => Number.isInteger(x) && x >= 0);
    const change = (revoke: boolean) => playerId && grant.mutate({ playerId, setIds, revoke });

    return (
        <Panel title="Clothing for sale" description="A piece marked as sold is worn only by players who own it. Taking one takes it off them at once.">
            <div className="flex flex-col gap-3 p-4">
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
                    <Labeled label="Player id"><Input value={player} onChange={event => setPlayer(event.target.value)} inputMode="numeric" className="w-full font-mono" /></Labeled>
                    <Labeled label="Piece ids"><Input value={sets} onChange={event => setSets(event.target.value)} placeholder="3030, 3031" className="w-full font-mono" /></Labeled>
                    <div className="flex gap-2">
                        <Button variant="secondary" icon={<Plus />} disabled={!playerId || setIds.length === 0 || grant.isPending} onClick={() => change(false)}>Give</Button>
                        <Button variant="ghost" icon={<Trash2 />} disabled={!playerId || setIds.length === 0 || grant.isPending} onClick={() => change(true)}>Take</Button>
                    </div>
                </div>
                {error && <ErrorNotice error={error} />}
                {grant.error && <ErrorNotice error={grant.error} />}
                {grant.data && <SuccessNotice>{grant.data.changed} changed.</SuccessNotice>}
                {owned && (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="text-muted">Owns</span>
                        {owned.setIds.length ? owned.setIds.map(id => <Badge key={id}>{id}</Badge>) : <span className="text-muted">no pieces for sale.</span>}
                    </div>
                )}
            </div>
        </Panel>
    );
};

/**
 * The hotel's figure data: the clothing and colours avatars are drawn from, and who may wear
 * each - everyone, club members, or (for a piece sold) its owners. Every figure a player puts
 * on is fitted to these rules; what they may not wear comes off.
 */
export const FiguresTab = ({ status }: { status: GamedataStatus }) => {
    const [ params ] = useSearchParams();
    const [ view, setView ] = useState(() => (VIEWS.some(x => x.value === params.get('view')) ? params.get('view')! : 'clothing'));

    return (
        <>
            <HabboFigures status={status} />
            <BundleUpdate kind="figure" canManage={status.canManage} />
            <div className="w-full sm:w-80">
                <Segmented label="Show" value={view} onChange={setView} options={VIEWS} />
            </div>
            {view === 'colours' && <PaletteEditor canManage={status.canManage} />}
            {view === 'clothing' && <ClothingEditor canManage={status.canManage} />}
            {view === 'bundles' && <BundleList kind="figure" canManage={status.canManage} />}
            {status.canManage && view === 'clothing' && <PlayerClothing />}
        </>
    );
};
