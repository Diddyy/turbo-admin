import { ArchiveRestore, DatabaseBackup, Eraser, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type CatalogBackup, catalogCalls, type CatalogTree, useCatalogBackups, useCatalogEdit } from '#/api/catalog';
import { ask } from '#/components/confirm';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, EmptyState, ErrorNotice, IconButton, Input, Loading } from '#/components/ui';

/** The longest name a backup takes, as the server holds it. */
const NAME_MAX_LENGTH = 100;

const takenAt = (utc: string) => new Date(utc).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

const BackupRow = ({ backup, canManage, busy, onRollback, onDelete }: { backup: CatalogBackup; canManage: boolean; busy: boolean; onRollback: () => void; onDelete: () => void }) => (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{backup.name}</span>
                {backup.automatic && <Badge tone="amber">Automatic</Badge>}
            </div>
            <div className="truncate text-xs text-muted">
                {takenAt(backup.takenAtUtc)}
                {' · '}
                {backup.takenByName ?? `player ${backup.takenById}`}
            </div>
        </div>
        <div className="font-mono text-xs text-muted tabular-nums">
            {backup.pages.toLocaleString()} pages · {backup.offers.toLocaleString()} offers · {backup.featuredItems} featured
        </div>
        {canManage && (
            <div className="flex items-center gap-1.5">
                <Button variant="secondary" icon={<ArchiveRestore />} disabled={busy} onClick={onRollback} title="Put the catalog back as this backup has it">
                    Roll back
                </Button>
                <IconButton label={`Delete the backup ${backup.name}`} icon={<Trash2 />} tone="bad" disabled={busy} onClick={onDelete} />
            </div>
        )}
    </li>
);

/**
 * The catalog's backups: copies of every page, offer, product and featured item as they were
 * saved when taken. Rolling back puts the catalog back as one is, ids included, as one change that
 * can be undone and goes live when published; what it replaces is backed up first, so a rollback
 * can itself be rolled back after a publish. Limited series stay as they are. Resetting empties
 * the catalog to its root, backed up first in the same way.
 */
export const Backups = ({ tree }: { tree: CatalogTree }) => {
    const backups = useCatalogBackups();
    const take = useCatalogEdit(catalogCalls.backup);
    const rollback = useCatalogEdit(catalogCalls.rollback);
    const remove = useCatalogEdit(catalogCalls.deleteBackup);
    const reset = useCatalogEdit(catalogCalls.reset);
    const [ name, setName ] = useState('');
    const busy = take.isPending || rollback.isPending || remove.isPending || reset.isPending;
    const items = backups.data?.items ?? [];

    const doTake = () => take.mutate([ name ], {
        onSuccess: () => {
            setName('');
            toast('Backed up: every page, offer and featured item as saved now.');
        },
        onError: toastError,
    });

    const doRollback = (backup: CatalogBackup) => {
        ask({
            title: `Roll the catalog back to "${backup.name}"?`,
            body: 'Every page, offer and featured item goes back as it has them. What is there now is backed up first, and you can undo it. Players get it when you publish.',
            confirm: 'Roll back',
        }, () => {
            rollback.mutate([ backup.id ], {
                onSuccess: () => toast(`Rolled back to "${backup.name}". Publish to put it in front of players.`),
                onError: toastError,
            });
        });
    };

    const doReset = () => {
        ask({
            title: 'Reset the catalog?',
            body: 'Every page but the root, and every offer and featured item, is taken away. What is there now is backed up first, and you can undo it. Players get the empty catalog when you publish.',
            confirm: 'Reset',
        }, () => {
            reset.mutate([], {
                onSuccess: () => toast('Reset: the catalog is empty, and what was there is kept as "Before resetting the catalog". Publish to put it in front of players.'),
                onError: toastError,
            });
        });
    };

    const doDelete = (backup: CatalogBackup) => {
        ask({ title: `Delete the backup "${backup.name}"?`, body: 'It can\'t be brought back.', confirm: 'Delete' }, () => {
            remove.mutate([ backup.id ], {
                onSuccess: () => toast(`Deleted the backup "${backup.name}".`),
                onError: toastError,
            });
        });
    };

    return (
        <div className="flex flex-col gap-3">
            {tree.canManage && (
                <form
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        doTake();
                    }}
                >
                    <span className="flex items-center gap-2 text-sm font-medium">
                        <DatabaseBackup className="size-4 text-accent" />
                        Back up the catalog
                    </span>
                    <Input value={name} onChange={event => setName(event.target.value)} maxLength={NAME_MAX_LENGTH} placeholder="Name it (optional)" aria-label="Backup name" className="min-w-0 flex-1 sm:max-w-sm" />
                    <Button type="submit" icon={<Save />} disabled={busy}>
                        Back up now
                    </Button>
                    <p className="w-full text-xs text-muted">
                        Keeps every page, offer and featured item as they are saved now, published or not. Rolling back is one change you can undo, and goes live when you publish.
                    </p>
                </form>
            )}

            {backups.error && <ErrorNotice error={backups.error} />}
            {backups.isPending && <Loading />}
            {backups.data && items.length === 0 && (
                <EmptyState framed icon={<DatabaseBackup className="text-muted" />}>No backups yet.</EmptyState>
            )}
            {items.length > 0 && (
                <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                    {items.map(backup => (
                        <BackupRow
                            key={backup.id}
                            backup={backup}
                            canManage={tree.canManage}
                            busy={busy}
                            onRollback={() => doRollback(backup)}
                            onDelete={() => doDelete(backup)}
                        />
                    ))}
                </ul>
            )}

            {tree.canManage && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-bad-line bg-bad-soft/60 p-3">
                    <div className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-medium">
                            <Eraser className="size-4 text-bad" />
                            Reset the catalog
                        </span>
                        <p className="text-xs text-muted">
                            Takes away every page but the root, and every offer, product and featured item, to start again or import a catalog into. It is backed up first, can be undone, and goes live when you publish. Refused while an offer sells a limited series or Builders Club furni was placed from one.
                        </p>
                    </div>
                    <Button variant="danger" icon={<Eraser />} disabled={busy} onClick={doReset}>
                        Reset
                    </Button>
                </div>
            )}
        </div>
    );
};
