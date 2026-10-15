import { Plus, Save, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { FILES, type GamedataStatus, type ProductEntry, useDeleteProduct, useProductImport, useProductImportPreview, useProductSearch, useSaveProduct } from '#/api/gamedata';
import { ask } from '#/components/confirm';
import { ListToolbar } from '#/components/ListToolbar';
import { SearchInput } from '#/components/SearchInput';
import { Badge, Button, EmptyState, ErrorNotice, Input, Labeled, Loading, Panel, Textarea } from '#/components/ui';
import { cx } from '#/lib/cx';

import { FieldChanges, HabboDiffers, HabboUpdate, OpenRow, ReviewItem } from './parts';

/** Habbo's newest product data: what taking it in would change. */
export const HabboProducts = ({ status, defaultOpen }: { status: GamedataStatus; defaultOpen?: boolean }) => {
    const version = status.latestProducts;
    const { data: preview, error } = useProductImportPreview(version !== null);
    const take = useProductImport();

    return (
        <HabboUpdate
            defaultOpen={defaultOpen}
            title="product data"
            version={version && { name: version.hash.slice(0, 10), holds: `${version.productCount.toLocaleString()} products`, foundAt: version.foundAt, importedAt: version.importedAt }}
            preview={preview && { ...preview, listed: preview.items.length }}
            error={error}
            file={FILES.productData}
            canManage={status.canManage}
            canTake={!!preview && preview.added + preview.updated + preview.kept > 0}
            confirm={preview ? { title: 'Take in Habbo\'s product data?', body: `${preview.added} products are added and ${preview.updated} updated. It runs in the background and can be rolled back from the history.` } : { title: '' }}
            onTake={() => preview && take.mutate(preview.version.id)}
            taking={take.isPending}
            takeError={take.error}
        >
            {preview?.items.map(item => (
                <ReviewItem key={item.code} action={item.action} name={item.code}>
                    <FieldChanges fields={item.fields} />
                </ReviewItem>
            ))}
        </HabboUpdate>
    );
};

/** A product's name and description to change, Habbo's beside them where they differ. */
const ProductEditor = ({ product, canManage, onDone }: { product: ProductEntry | null; canManage: boolean; onDone: () => void }) => {
    const [ code, setCode ] = useState(product?.code ?? '');
    const [ name, setName ] = useState(product?.name ?? '');
    const [ description, setDescription ] = useState(product?.description ?? '');
    const save = useSaveProduct();
    const remove = useDeleteProduct();
    const changed = !product || name !== (product.name ?? '') || description !== (product.description ?? '');

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
                event.preventDefault();
                save.mutate({ code: product?.code ?? code, name, description }, { onSuccess: onDone });
            }}
        >
            {!product && (
                <Labeled label="Code" hint="The name key of the offers it names.">
                    <Input value={code} onChange={event => setCode(event.target.value)} placeholder="my_chair_blue" className="w-full font-mono sm:max-w-80" autoFocus />
                </Labeled>
            )}
            <div className="grid gap-3 sm:grid-cols-[minmax(12rem,1fr)_2fr]">
                <div className="flex flex-col gap-1">
                    <Labeled label="Name"><Input value={name} onChange={event => setName(event.target.value)} disabled={!canManage} /></Labeled>
                    {product?.fromHabbo && name !== (product.habboName ?? '') && <HabboDiffers habbo={product.habboName || '""'} canManage={canManage} onUse={() => setName(product.habboName ?? '')} />}
                </div>
                <div className="flex flex-col gap-1">
                    <Labeled label="Description"><Textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} disabled={!canManage} /></Labeled>
                    {product?.fromHabbo && description !== (product.habboDescription ?? '') && <HabboDiffers habbo={product.habboDescription || '""'} canManage={canManage} onUse={() => setDescription(product.habboDescription ?? '')} />}
                </div>
            </div>
            {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="submit" icon={product ? <Save /> : <Plus />} disabled={!changed || save.isPending || (!product && code.trim() === '')}>{product ? 'Save' : 'Add'}</Button>
                    <Button variant="ghost" icon={<X />} onClick={onDone}>Cancel</Button>
                    {product && (
                        <Button
                            variant="ghost"
                            icon={<Trash2 />}
                            className="ml-auto text-bad hover:text-bad"
                            disabled={remove.isPending}
                            onClick={() => ask(
                                {
                                    title: `Remove the product ${product.code}?`,
                                    body: 'Habbo\'s later updates leave it removed unless Habbo changes it.',
                                    confirm: 'Remove',
                                },
                                () => remove.mutate(product.code, { onSuccess: onDone }),
                            )}
                        >
                            Remove
                        </Button>
                    )}
                </div>
            )}
            {(save.error || remove.error) && <ErrorNotice error={save.error ?? remove.error} />}
        </form>
    );
};

/** Where a product came from, as a badge: none for Habbo's as Habbo has it. */
const Origin = ({ product }: { product: ProductEntry }) => {
    if (!product.fromHabbo)
        return <Badge tone="green">hotel's own</Badge>;

    if (product.name !== product.habboName || product.description !== product.habboDescription)
        return <Badge tone="amber">changed</Badge>;

    return null;
};

/**
 * The hotel's product data: the name and description the client shows for a catalog offer, by
 * the code its name key gives. A product changed here stays when Habbo changes it; one removed
 * here stays removed unless Habbo changes it.
 */
export const ProductsTab = ({ status }: { status: GamedataStatus }) => {
    const [ params ] = useSearchParams();
    // Opened from the search: what it found, and the one picked there open.
    const [ text, setText ] = useState(() => params.get('q') ?? '');
    const [ page, setPage ] = useState(0);
    const [ open, setOpen ] = useState<string | null>(() => params.get('open'));
    const { data: found, isFetching, error } = useProductSearch(text, page);
    const size = found?.pageSize ?? 1;

    return (
        <>
            <HabboProducts status={status} />
            <Panel className="overflow-clip">
                <ListToolbar
                    watch={[ text, page ]}
                    page={{ offset: page * size, limit: size, total: found?.total, onChange: offset => setPage(Math.floor(offset / size)) }}
                >
                    <SearchInput
                        value={text}
                        onValueChange={(value) => {
                            setText(value);
                            setPage(0);
                        }}
                        placeholder="Code, name or description"
                        className="min-w-48 flex-1 sm:max-w-96"
                        aria-label="Find products"
                    />
                    {status.canManage && <Button variant="secondary" icon={<Plus />} onClick={() => setOpen('')}>New product</Button>}
                </ListToolbar>
                {open === '' && (
                    <div className="border-b border-line bg-subtle/40 p-4">
                        <ProductEditor product={null} canManage={status.canManage} onDone={() => setOpen(null)} />
                    </div>
                )}
                {error && <div className="p-4"><ErrorNotice error={error} /></div>}
                {!found && isFetching && <Loading />}
                {found && found.items.length === 0 && <EmptyState>{text.trim() ? 'No product has those words.' : 'No products yet: take Habbo’s in above.'}</EmptyState>}
                {found && found.items.length > 0 && (
                    <ul className={cx('divide-y divide-line transition-opacity', isFetching && 'opacity-60')}>
                        {found.items.map(item => (
                            <OpenRow
                                key={item.code}
                                open={open === item.code}
                                onToggle={() => setOpen(open === item.code ? null : item.code)}
                                summary={(
                                    <div className="grid items-center gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(10rem,16rem)_minmax(8rem,1fr)_2fr_auto]">
                                        <span className="truncate font-mono text-[13px]">{item.code}</span>
                                        <span className="truncate font-medium">{item.name || <span className="text-muted">no name</span>}</span>
                                        <span className="truncate text-muted max-sm:hidden">{item.description}</span>
                                        <span className="max-sm:hidden"><Origin product={item} /></span>
                                    </div>
                                )}
                            >
                                <ProductEditor key={`${item.name}:${item.description}`} product={item} canManage={status.canManage} onDone={() => setOpen(null)} />
                            </OpenRow>
                        ))}
                    </ul>
                )}
            </Panel>
        </>
    );
};
