import { FolderTree } from 'lucide-react';
import { useState } from 'react';

import { type AddFurniSort, catalogCalls, type CatalogTree, useCatalogEdit, useResortPlan } from '#/api/catalog';
import { Modal } from '#/components/Modal';
import { toast, toastError } from '#/components/toast';
import { Button, ErrorNotice, Loading, Segmented } from '#/components/ui';

import { SORT_HINTS, SORTS } from './subPageSorts';
import { SubPagesTree } from './SubPagesTree';

const plural = (count: number, one: string, many: string) => `${count.toLocaleString()} ${count === 1 ? one : many}`;

/**
 * A page's offers sorted onto pages under it - by kind, by colour, or by kind and then colour -
 * as the audit's add sorts new furni: the pages listed before anything moves, the offers moved as
 * they are (prices, limited series and all), and one step to undo. Offers selling anything but
 * one floor or wall item stay on the page.
 */
export const ResortPageDialog = ({ tree, pageId, onClose }: { tree: CatalogTree; pageId: number; onClose: () => void }) => {
    const [ sortBy, setSortBy ] = useState<AddFurniSort>('kind');
    const plan = useResortPlan(pageId, sortBy);
    const resort = useCatalogEdit(catalogCalls.resortPage);
    const title = tree.pages.find(x => x.id === pageId)?.localization ?? `page ${pageId}`;
    const pages = plan.data?.pages ?? [];

    const submit = () => resort.mutate([ pageId, sortBy ], {
        onSuccess: (result) => {
            toast(`Sorted ${title}: ${plural(result.done, 'offer', 'offers')} moved onto the pages under it. Publish to put it live.`);
            onClose();
        },
        onError: toastError,
    });

    return (
        <Modal title={<span className="flex items-center gap-2"><FolderTree className="size-4 text-accent" />{`Sort ${title} into sub pages`}</span>} open onClose={onClose} className="sm:h-fit! sm:max-w-2xl">
            <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-1.5">
                    <div className="max-w-full overflow-x-auto">
                        <Segmented label="Sort by" value={sortBy} onChange={value => setSortBy(value as AddFurniSort)} options={SORTS} />
                    </div>
                    <p className="text-xs text-muted">{SORT_HINTS[sortBy]}</p>
                </div>
                {plan.error && <ErrorNotice error={plan.error} />}
                {plan.isPending && <Loading />}
                {plan.data && (pages.length === 0
                    ? <p className="text-sm text-muted">Nothing to sort it into this way: no two kinds or colours have three offers each.</p>
                    : (
                            <div className="flex flex-col gap-2">
                                <SubPagesTree pages={pages} fetching={plan.isFetching} className="max-h-72" />
                                {plan.data.staying > 0 && (
                                    <p className="text-xs text-muted">{`${plural(plan.data.staying, 'offer stays', 'offers stay')} on ${title}: ${plan.data.staying === 1 ? 'it sells' : 'they sell'} something other than one furni.`}</p>
                                )}
                            </div>
                        ))}
                <p className="text-xs text-muted">The offers move as they are, prices and all. A new page takes this page's layout, header, teaser and texts; a page of a title there already takes its offers as it is. You can undo it.</p>
                <div className="flex justify-end gap-2 border-t border-line pt-3">
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button icon={<FolderTree />} disabled={pages.length === 0 || resort.isPending} onClick={submit}>
                        {resort.isPending ? 'Sorting…' : 'Sort'}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
