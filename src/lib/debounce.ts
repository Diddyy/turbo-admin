import { useEffect, useState } from 'react';

/**
 * A value once it has stopped changing for `ms`: what a search box asks the server for, so typing
 * a word sends one request rather than one a letter. Cleared at once, so emptying the box doesn't wait.
 */
export const useDebounced = <T>(value: T, ms = 250): T => {
    const [ settled, setSettled ] = useState(value);
    const empty = value === '';

    useEffect(() => {
        if (empty)
            return;

        const timer = setTimeout(() => setSettled(value), ms);

        return () => clearTimeout(timer);
    }, [ value, ms, empty ]);

    return empty ? value : settled;
};
