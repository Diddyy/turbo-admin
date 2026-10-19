import { useParams } from 'react-router';

import { ToTab } from '#/components/ToTab';

/**
 * A page's tab, the last part of its path (`/content/badges`), and, when the path names none the
 * page has, where to go instead: its first. The page renders that in its place, after its hooks.
 */
export const usePathTab = <T extends string>(values: readonly T[]) => {
    const { tab } = useParams();
    const known = values.find(x => x === tab);
    const first = values[0]!;

    return [ known ?? first, known ? null : <ToTab to={tab ? `../${first}` : first} /> ] as const;
};
