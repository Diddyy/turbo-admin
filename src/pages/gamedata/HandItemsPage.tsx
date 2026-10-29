import { useDeferredValue, useEffect, useRef, useState } from 'react';

import { type HandItem, handItemPreview, useHandItems } from '#/api/gamedata';
import { SearchInput } from '#/components/SearchInput';
import { Button, EmptyState, ErrorNotice, Loading } from '#/components/ui';

export const HandItemPreview = ({ item, compact = false }: { item: HandItem; compact?: boolean }) => {
    const host = useRef<HTMLSpanElement>(null);
    const [ visible, setVisible ] = useState(() => !('IntersectionObserver' in window));
    const [ url, setUrl ] = useState<string | null>(null);
    const [ failed, setFailed ] = useState(false);

    useEffect(() => {
        const node = host.current;

        if (!node || !('IntersectionObserver' in window))
            return;

        const observer = new IntersectionObserver(([ entry ]) => {
            if (entry?.isIntersecting) {
                setVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '160px' });

        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!visible || !item.previewAvailable)
            return;

        let current: string | null = null;
        let active = true;
        void handItemPreview(item.id).then((blob) => {
            if (active) {
                current = URL.createObjectURL(blob);
                setUrl(current);
            }
        }).catch(() => {
            if (active)
                setFailed(true);
        });

        return () => {
            active = false;
            if (current)
                URL.revokeObjectURL(current);
        };
    }, [ item.id, item.previewAvailable, visible ]);

    return (
        <span ref={host} className={`grid ${compact ? 'size-10' : 'size-16'} shrink-0 place-items-center overflow-hidden rounded-lg bg-subtle`}>
            {url && !failed ? <img src={url} alt="" className="max-h-full max-w-full [image-rendering:pixelated]" /> : <span className="text-xs text-muted">{item.previewAvailable ? 'Preview' : 'No preview'}</span>}
        </span>
    );
};

export const HandItemsPage = () => {
    const { data, error, isLoading, isFetching, refetch } = useHandItems();
    const [ search, setSearch ] = useState('');
    const query = useDeferredValue(search.trim().toLocaleLowerCase());
    const items = (data?.items ?? []).filter(item => !query || `${item.id} ${item.name ?? ''} ${item.library ?? ''}`.toLocaleLowerCase().includes(query));

    return (
        <>
            <p className="text-sm text-muted">Hand items available to vending furniture, with locally stored names and artwork.</p>
            <section className="flex flex-col gap-4 lg:gap-5">
                <div className="flex items-center gap-3"><SearchInput value={search} onValueChange={setSearch} placeholder="Name or ID" aria-label="Search hand items" className="w-full sm:w-72" /><Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>Refresh</Button></div>
                {data?.message && <p className="rounded-lg bg-canvas px-3 py-2.5 text-sm text-muted">{data.message} Download and build client assets if needed, then sync assets and import texts for names.</p>}
                {error && <ErrorNotice error={error} />}
                {isLoading && <Loading />}
                {data && items.length === 0 && <EmptyState>{query ? 'No hand items match that search.' : 'No hand items are available yet. Download and build client assets, sync assets and import texts, then try again.'}</EmptyState>}
                {data && items.length > 0 && (
                    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
                        {items.map(item => (
                            <li key={item.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                                <HandItemPreview key={`${data.revision}-${item.id}`} item={item} />
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="truncate font-medium">{item.name || `Hand item ${item.id}`}</span>
                                    <span className="font-mono text-xs text-muted">Hand item {item.id}</span>
                                </span>
                                <span className="shrink-0 text-right text-xs text-muted">{item.assetAvailable ? 'Asset available' : 'Asset missing'}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
};
