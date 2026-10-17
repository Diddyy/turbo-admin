import { Check, Hammer, Pencil, X } from 'lucide-react';
import { useState } from 'react';

import { FILES, type GamedataFile, type GamedataStatus, useRebuild, useSetFileKey } from '#/api/gamedata';
import { PhoneLabel, Row, RowList } from '#/components/RowList';
import { Badge, Button, ErrorNotice, IconButton, Input, Panel, SuccessNotice } from '#/components/ui';
import { fromNow } from '#/lib/time';

import { formatSize } from './labels';

interface FileRow {
    what: string;
    file: GamedataFile;
    /** The client's setting that loads it, as the client names it. */
    setting: string;
}

/**
 * The client setting a file's address is written under: the variables that follow it. Staff who
 * manage the gamedata can choose another key; the one before is unlinked, keeping the /0 address.
 */
const FileKey = ({ file, keys, fallback, canManage }: { file: string; keys: string[]; fallback: string; canManage: boolean }) => {
    const [ editing, setEditing ] = useState(false);
    const [ key, setKey ] = useState('');
    const setFileKey = useSetFileKey();
    const shown = keys.length > 0 ? keys.join(', ') : null;

    if (editing) {
        const save = () => setFileKey.mutate({ file, key: key.trim() }, { onSuccess: () => setEditing(false) });

        return (
            <span className="flex min-w-0 flex-col gap-1">
                <span className="flex items-center gap-1">
                    <Input
                        value={key}
                        onChange={event => setKey(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && key.trim() !== '') save();
                            if (event.key === 'Escape') setEditing(false);
                        }}
                        placeholder={fallback}
                        aria-label={`Client setting for ${file}`}
                        className="min-w-0 flex-1 font-mono text-xs"
                        autoFocus
                    />
                    <IconButton label="Save" icon={<Check />} disabled={key.trim() === '' || setFileKey.isPending} onClick={save} />
                    <IconButton label="Cancel" icon={<X />} onClick={() => setEditing(false)} />
                </span>
                {setFileKey.error && <ErrorNotice error={setFileKey.error} />}
            </span>
        );
    }

    return (
        <span className="flex min-w-0 items-center gap-1">
            <span className="truncate font-mono text-xs" title={shown ?? undefined}>
                <PhoneLabel>Setting </PhoneLabel>
                {shown ?? <Badge tone="amber">no variable</Badge>}
            </span>
            {canManage && (
                <IconButton
                    label="Change the client setting"
                    icon={<Pencil />}
                    onClick={() => {
                        setKey(keys[0] ?? fallback);
                        setFileKey.reset();
                        setEditing(true);
                    }}
                />
            )}
        </span>
    );
};

/**
 * The gamedata files clients load, built from the database whenever what they're made from
 * changes, with the client setting each address is written under. They are served by the hotel's
 * own gamedata host; the bundles are published to their targets beside them.
 */
export const ClientFiles = ({ status }: { status: GamedataStatus }) => {
    const rebuild = useRebuild();
    const files: FileRow[] = [
        { what: 'Furniture data', file: status.furnitureData, setting: 'furnituredata.url' },
        { what: 'Product data', file: status.productData, setting: 'productdata.url' },
        { what: 'External texts', file: status.externalTexts, setting: 'gamedata.urls.externalTexts' },
        { what: 'Figure data', file: status.figureData, setting: 'figuredata.url' },
        { what: 'External variables', file: status.externalVariables, setting: 'nitro.config.url' },
        ...(status.figureMap ? [ { what: 'Figure map', file: status.figureMap, setting: 'figuremap.url' } ] : []),
        ...(status.effectMap ? [ { what: 'Effect map', file: status.effectMap, setting: 'effectmap.url' } ] : []),
    ];

    return (
        <Panel
            title="Files the client loads"
            description="Built from the database whenever what they're made from changes. Each file's address is written into the external variables under its client setting; change the key here if your client reads another. The external variables themselves are loaded from the client's page by nitro.config.url."
            actions={status.canManage && (
                <Button
                    variant="secondary"
                    icon={<Hammer />}
                    disabled={rebuild.isPending}
                    onClick={() => Object.values(FILES).forEach(file => rebuild.mutate(file))}
                >
                    Rebuild all
                </Button>
            )}
        >
            <RowList
                columns="minmax(12rem,1.4fr) minmax(12rem,1.2fr) 7rem 5rem 7rem"
                headers={[ { label: 'File' }, { label: 'Client setting' }, { label: 'Build' }, { label: 'Size', className: 'text-right' }, { label: 'Built' } ]}
            >
                {files.map((row) => {
                    const keys = status.fileKeys?.[row.file.file];

                    return (
                        <Row key={row.file.file}>
                            <span className="min-w-0">
                                <span className="block font-medium">{row.what}</span>
                                <span className="block truncate font-mono text-[11px] text-muted">/gamedata/{row.file.file}/0</span>
                            </span>
                            {keys
                                ? <FileKey file={row.file.file} keys={keys} fallback={row.setting} canManage={status.canManage} />
                                : <span className="truncate font-mono text-xs"><PhoneLabel>Setting </PhoneLabel>{row.setting}</span>}
                            <span className="font-mono text-xs" title={row.file.hash}>{row.file.hash.slice(0, 10)}</span>
                            <span className="font-mono text-xs text-muted tabular-nums sm:text-right">{formatSize(row.file.size)}</span>
                            <span className="text-xs text-muted">{fromNow(row.file.builtAt)}</span>
                        </Row>
                    );
                })}
            </RowList>
            {(rebuild.error || rebuild.isSuccess) && (
                <div className="border-t border-line p-4">
                    {rebuild.error && <ErrorNotice error={rebuild.error} />}
                    {rebuild.isSuccess && !rebuild.error && <SuccessNotice>Rebuilt.</SuccessNotice>}
                </div>
            )}
        </Panel>
    );
};
