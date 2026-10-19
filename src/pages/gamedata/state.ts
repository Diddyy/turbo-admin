import { useParams, useSearchParams } from 'react-router';

import { useAssetsStatus } from '#/api/bundles';
import { useGamedataStatus } from '#/api/gamedata';

/** The gamedata's state and the assets', which every gamedata page is drawn from. */
export const useGamedata = () => {
    const { data: status, error } = useGamedataStatus();
    const { data: assets, error: assetsError } = useAssetsStatus();

    return { status, assets, error: error ?? assetsError, canManage: !!status?.canManage && !!assets?.canManage };
};

/** The page's tab, the last part of its path: the one asked for if the page has it, else its first. */
export const useTab = <T extends string>(values: readonly T[]): T => {
    const { tab } = useParams();

    return values.find(x => x === tab) ?? values[0]!;
};

/** What a link opened a tab with; a tab opened again from the search, with something else found, starts over with it. */
export const useFoundKey = () => {
    const [ params ] = useSearchParams();

    return [ 'q', 'id', 'open', 'tag', 'status', 'view' ].map(x => params.get(x)).join('|');
};
