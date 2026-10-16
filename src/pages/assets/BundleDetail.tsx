import { Download, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { type BundleKind, downloadBundle, useBundle, useDeleteBundle } from '#/api/bundles';
import { ask } from '#/components/confirm';
import { Modal } from '#/components/Modal';
import { toast, toastError } from '#/components/toast';
import { Badge, Button, ErrorNotice, Kv, Label, Loading } from '#/components/ui';
import { fromNow } from '#/lib/time';

import { BundleIcon } from './BundleIcon';
import { formatBytes, formatTime } from './format';

/**
 * One bundle: where it came from, its hash, and what its zip holds; it can be downloaded, and
 * deleted by staff who manage the assets (a Habbo library comes back with the next sync).
 */
export const BundleDetail = ({ bundle, canManage, onClose }: { bundle: { kind: BundleKind; name: string } | null; canManage: boolean; onClose: () => void }) => {
    const { data, error } = useBundle(bundle);
    const remove = useDeleteBundle();
    const [ downloading, setDownloading ] = useState(false);
    const total = data?.files.reduce((sum, file) => sum + file.size, 0) ?? 0;

    const download = () => {
        if (!bundle)
            return;

        setDownloading(true);
        downloadBundle(bundle.kind, bundle.name).catch(toastError).finally(() => setDownloading(false));
    };

    return (
        <Modal
            open={!!bundle}
            onClose={onClose}
            className="sm:h-fit! sm:max-w-2xl"
            title={bundle && (
                <span className="flex items-center gap-2.5">
                    <BundleIcon kind={bundle.kind} name={bundle.name} className="size-8" />
                    <span className="truncate font-mono">{bundle.name}</span>
                </span>
            )}
        >
            {error && <div className="p-5"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {data && bundle && (
                <div className="flex flex-col gap-4 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <Badge>{data.kind}</Badge>
                        <Badge tone={data.source === 'habbo' ? 'neutral' : 'accent'}>{data.source}</Badge>
                        {data.error ? <Badge tone="red">failed</Badge> : <Badge tone="green">ok</Badge>}
                        {!data.used && <Badge tone="amber">unused</Badge>}
                    </div>

                    {data.error && <ErrorNotice error={new Error(data.error)} />}

                    <dl className="rounded-xl border border-line">
                        <Kv label="Revision">{data.revision ?? '-'}</Kv>
                        <Kv label="Size">{formatBytes(data.size)}</Kv>
                        <Kv label={data.kind === 'pet' ? 'Pet type' : 'Ids'}>{data.ids.length > 0 ? data.ids.join(', ') : '-'}</Kv>
                        <Kv label="Updated"><span title={formatTime(data.updatedAt)}>{fromNow(data.updatedAt)}</span></Kv>
                        <Kv label="Path"><span className="break-all">{data.path}</span></Kv>
                        <Kv label="Hash"><span className="text-xs break-all">{data.hash ?? '-'}</span></Kv>
                    </dl>

                    <div>
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                            <Label>In the zip</Label>
                            <span className="font-mono text-xs text-muted">{`${data.files.length} files, ${formatBytes(total)}`}</span>
                        </div>
                        {data.files.length > 0
                            ? (
                                    <ul className="divide-y divide-line rounded-xl border border-line font-mono text-xs">
                                        {data.files.map(file => (
                                            <li key={file.name} className="flex items-center justify-between gap-3 px-3 py-2">
                                                <span className="min-w-0 truncate" title={file.name}>{file.name}</span>
                                                <span className="shrink-0 text-muted tabular-nums">{formatBytes(file.size)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )
                            : <p className="text-sm text-muted">It has no file.</p>}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                        {canManage
                            ? (
                                    <Button
                                        variant="danger"
                                        icon={<Trash2 />}
                                        disabled={remove.isPending}
                                        onClick={() => ask(
                                            `Delete the bundle ${bundle.name}? ${data.source === 'habbo' ? 'The next sync downloads it again from Habbo.' : data.source === 'built' ? 'It is built again on the next change to what it is built from.' : 'It was uploaded, so it is gone until it is uploaded again.'}`,
                                            () => remove.mutate(bundle, {
                                                onSuccess: () => {
                                                    toast(`Deleted ${bundle.name}.`);
                                                    onClose();
                                                },
                                                onError: toastError,
                                            }),
                                        )}
                                    >
                                        Delete
                                    </Button>
                                )
                            : <span />}
                        <Button icon={<Download />} disabled={downloading || data.files.length === 0} onClick={download}>
                            {downloading ? 'Downloading' : 'Download .nitro'}
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
};
