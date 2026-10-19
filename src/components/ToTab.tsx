import { Navigate, useLocation } from 'react-router';

/**
 * Goes to a page's first tab, by a path from where the address is now (`overview` from
 * `/rooms/5`, `../products` from `/gamedata/nothing`), keeping what it searched for.
 */
export const ToTab = ({ to }: { to: string }) => (
    <Navigate to={{ pathname: to, search: useLocation().search }} relative="path" replace />
);
