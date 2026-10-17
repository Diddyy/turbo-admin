import { useSearchParams } from 'react-router';

import { useAssetsStatus } from '#/api/bundles';
import { useGamedataStatus } from '#/api/gamedata';

/** The gamedata's state and the assets', which every gamedata page is drawn from. */
export const useGamedata = () => {
    const { data: status, error } = useGamedataStatus();
    const { data: assets, error: assetsError } = useAssetsStatus();

    return { status, assets, error: error ?? assetsError, canManage: !!status?.canManage && !!assets?.canManage };
};

/** The page's tab, kept in `?tab=`: the one asked for if the page has it, else its first. */
export const useTab = (values: readonly string[]) => {
    const [ params, setParams ] = useSearchParams();
    const asked = params.get('tab');
    const tab = asked && values.includes(asked) ? asked : values[0]!;

    return [ tab, (value: string) => setParams({ tab: value }, { replace: true }) ] as const;
};

/** What a link opened a tab with; a tab opened again from the search, with something else found, starts over with it. */
export const useFoundKey = () => {
    const [ params ] = useSearchParams();

    return [ 'q', 'id', 'open', 'tag', 'status', 'view' ].map(x => params.get(x)).join('|');
};
