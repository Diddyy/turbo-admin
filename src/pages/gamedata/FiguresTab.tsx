import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { FILES, type GamedataStatus, useFigureImport, useFigureImportPreview } from '#/api/gamedata';
import { Segmented } from '#/components/ui';
import { BundleList } from '#/pages/assets/BundleList';

import { ClothingEditor } from './ClothingEditor';
import { WaitingFromHabbo } from './frame';
import { PaletteEditor } from './PaletteEditor';
import { FieldChanges, HabboUpdate, ReviewItem } from './parts';

const KIND_NAMES: Record<number, string> = { 0: 'colour', 1: 'kind', 2: 'piece' };

const VIEWS = [
    { value: 'clothing', label: 'Pieces' },
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

/**
 * The hotel's clothing: the pieces avatars are drawn from and who may wear each - everyone, club
 * members, or (for a piece sold) its owners, given on a player's inventory - the palettes their
 * colours are picked from, or the bundles they are drawn from. Every figure a player puts on is
 * fitted to these rules; what they may not wear comes off.
 */
export const FiguresTab = ({ status }: { status: GamedataStatus }) => {
    const [ params ] = useSearchParams();
    const [ view, setView ] = useState(() => (VIEWS.some(x => x.value === params.get('view')) ? params.get('view')! : 'clothing'));

    return (
        <>
            <WaitingFromHabbo status={status} data="figures" bundles="figure" />
            <div className="w-full sm:w-80">
                <Segmented label="Show" value={view} onChange={setView} options={VIEWS} />
            </div>
            {view === 'clothing' && <ClothingEditor canManage={status.canManage} />}
            {view === 'colours' && <PaletteEditor canManage={status.canManage} />}
            {view === 'bundles' && <BundleList kind="figure" canManage={status.canManage} />}
        </>
    );
};
