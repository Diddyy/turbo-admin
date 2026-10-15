import { RotateCcw, X } from 'lucide-react';
import { useState } from 'react';

import { useHabboValuesPreview, useTakeHabboValues } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { Button, ErrorNotice, IconButton, Panel, SuccessNotice, Switch, WarningNotice } from '#/components/ui';

import { FIELDS } from './fields';

/**
 * Habbo's values put back over the hotel's in the fields chosen, for every furniture Habbo has -
 * after a first import kept the hotel's server columns (can put stuff on, recyclable, ...), or
 * to undo edits made field by field. Each field chosen shows how many definitions differ from
 * Habbo. It is one change set in the history, and rolls back as one.
 */
export const HabboValuesPanel = ({ onClose }: { onClose: () => void }) => {
    const [ chosen, setChosen ] = useState<string[]>([]);
    const { data: preview, error, isFetching } = useHabboValuesPreview(chosen);
    const take = useTakeHabboValues();

    const toggle = (key: string, on: boolean) => setChosen(current => (on ? [ ...current, key ] : current.filter(x => x !== key)));
    const affected = chosen.length > 0 ? preview?.definitions ?? 0 : 0;

    return (
        <Panel
            title="Use Habbo's values"
            description={preview?.release
                ? `Habbo's values from ${preview.release.revision.replace(/^PRODUCTION-/, '')} replace the hotel's in the fields chosen. The hotel's own furniture is left alone.`
                : 'Habbo’s values from its newest release replace the hotel’s in the fields chosen. The hotel’s own furniture is left alone.'}
            actions={(
                <>
                    <Button
                        icon={<RotateCcw />}
                        disabled={take.isPending || isFetching || affected === 0}
                        onClick={() => ask(
                            {
                                title: `Use Habbo's ${chosen.join(', ')} on ${affected} furniture?`,
                                body: 'It can be rolled back from the history.',
                                confirm: 'Use Habbo\'s',
                            },
                            () => take.mutate(chosen, { onSuccess: () => setChosen([]) }),
                        )}
                    >
                        {affected > 0 ? `Use on ${affected.toLocaleString()} furniture` : 'Use Habbo\'s'}
                    </Button>
                    <IconButton label="Close" icon={<X />} onClick={onClose} />
                </>
            )}
        >
            <div className="grid gap-x-6 px-4 py-2 sm:grid-cols-2 lg:grid-cols-3">
                {FIELDS.filter(field => !field.server).map(field => (
                    <Switch
                        key={field.key}
                        label={field.label}
                        hint={chosen.includes(field.key) && preview?.byField[field.key] !== undefined ? `${preview.byField[field.key]!.toLocaleString()} differ from Habbo` : undefined}
                        checked={chosen.includes(field.key)}
                        onChange={on => toggle(field.key, on)}
                    />
                ))}
            </div>
            {preview && !preview.release && (
                <div className="border-t border-line p-4">
                    <WarningNotice>Habbo hasn't been checked yet, so there are no values of Habbo's to use.</WarningNotice>
                </div>
            )}
            {(error || take.error || take.data) && (
                <div className="border-t border-line p-4">
                    {error && <ErrorNotice error={error} />}
                    {take.error && <ErrorNotice error={take.error} />}
                    {take.data && <SuccessNotice>{take.data.changeSet ? take.data.changeSet.summary : 'Nothing to change: those fields already had Habbo\'s values.'}</SuccessNotice>}
                </div>
            )}
        </Panel>
    );
};
