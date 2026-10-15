import { AlertTriangle, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { Link } from 'react-router';

import type { AssetCheck } from '#/api/bundles';
import { Badge, ErrorNotice, Loading, Panel } from '#/components/ui';
import { cx } from '#/lib/cx';

import { KIND_TABS, useFoundChecks } from './checkLists';

/** Where a check's findings are listed: furniture without a bundle by their tag, others in their kind's bundles. */
const listOf = (check: AssetCheck) => {
    if (check.id === 'furniture-missing')
        return '?tab=furniture&tag=no-bundle';

    return check.kind && check.status ? `?tab=${KIND_TABS[check.kind]}&status=${check.status}` : null;
};

/** One check: how many it found, what that means, and some of them; a link to the list it is about. */
export const CheckCard = ({ check }: { check: AssetCheck }) => {
    const error = check.severity === 'error';
    const Icon = error ? XCircle : AlertTriangle;
    const list = listOf(check);

    return (
        <li className={cx('flex gap-3 rounded-xl border px-4 py-3', error ? 'border-bad-line bg-bad-soft/60' : 'border-warn-line bg-warn-soft/60')}>
            <Icon className={cx('mt-0.5 size-4 shrink-0', error ? 'text-bad' : 'text-warn')} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium">{check.title}</span>
                    <Badge tone={error ? 'red' : 'amber'}>{check.count.toLocaleString()}</Badge>
                    {list && (
                        <Link to={list} className="ml-auto inline-flex min-h-8 items-center gap-1 text-xs font-medium text-accent hover:underline sm:min-h-0 [&>svg]:size-3.5">
                            Show them <ArrowRight />
                        </Link>
                    )}
                </div>
                <p className="text-[13px] text-muted">{check.detail}</p>
                {check.samples.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {check.samples.map(sample => (
                            <span key={sample} className="max-w-full truncate rounded-md border border-line bg-surface px-1.5 py-0.5 font-mono text-[11px]">{sample}</span>
                        ))}
                        {check.count > check.samples.length && (
                            <span className="px-1 py-0.5 font-mono text-[11px] text-muted">{`+${(check.count - check.samples.length).toLocaleString()} more`}</span>
                        )}
                    </div>
                )}
            </div>
        </li>
    );
};

/** Every check of the bundles against the hotel's furniture, effects and pets. */
export const Checks = () => {
    const { data, error, items } = useFoundChecks();

    return (
        <Panel title="Checks" description="The bundles against the hotel's furniture, effects and pets.">
            {error && <div className="p-4"><ErrorNotice error={error} /></div>}
            {!data && !error && <Loading />}
            {data && items.length === 0 && (
                <p className="flex items-center gap-2 px-4 py-6 text-sm text-good"><CheckCircle2 className="size-4" /> Everything checks out.</p>
            )}
            {items.length > 0 && <ul className="flex flex-col gap-2 p-3 sm:p-4">{items.map(check => <CheckCard key={check.id} check={check} />)}</ul>}
        </Panel>
    );
};
