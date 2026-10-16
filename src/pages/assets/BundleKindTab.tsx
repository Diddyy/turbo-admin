import type { BundleKind } from '#/api/bundles';

import { BundleList } from './BundleList';
import { BundleUpdate } from './BundleUpdate';
import { useFoundChecks } from './checkLists';
import { CheckCard } from './Checks';

/** The checks about each kind's bundles that its own tab shows. */
const KIND_CHECKS: Record<BundleKind, string[]> = {
    furniture: [ 'furniture-missing', 'furniture-unused' ],
    figure: [],
    effect: [ 'effects-missing' ],
    pet: [ 'pets-missing' ],
    template: [],
};

/**
 * A kind of bundle with no gamedata of its own to edit (effects, pets), laid out as every kind's
 * tab is: what Habbo has that the hotel lacks, what the checks found, then the bundles.
 */
export const BundleKindTab = ({ kind, canManage }: { kind: BundleKind; canManage: boolean }) => {
    const { items } = useFoundChecks(KIND_CHECKS[kind]);

    return (
        <>
            <BundleUpdate kind={kind} canManage={canManage} />
            {items.length > 0 && <ul className="flex flex-col gap-2">{items.map(check => <CheckCard key={check.id} check={check} />)}</ul>}
            <BundleList kind={kind} canManage={canManage} />
        </>
    );
};
