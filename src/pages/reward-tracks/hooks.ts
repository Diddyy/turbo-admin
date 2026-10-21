import { useClientAssets } from '#/api/assets';
import { useHotelViewTexts } from '#/api/hotelView';

import { menuTextKey } from './model';

/** The tracks' names, from the hotel's texts (`reward_track.<id>.name`), where it has them. */
export const useTrackNames = (ids: string[]) => {
    const { data } = useHotelViewTexts(ids.map(id => `reward_track.${id}.name`));

    return new Map((data?.texts ?? []).map(x => [ x.key.slice('reward_track.'.length, -'.name'.length), x.value ]));
};

/** The tracks' Progression menu item texts (`menuTextKey`), where the hotel has them. */
export const useMenuNames = (ids: string[]) => {
    const keys = new Map(ids.map(id => [ menuTextKey(id), id ]));
    const { data } = useHotelViewTexts([ ...keys.keys() ]);

    return new Map((data?.texts ?? []).map(x => [ keys.get(x.key)!, x.value ]));
};

/** The client's preview host for this panel (`/client/assets` `preview`), or null when the hotel names none. */
export const useGamePreviewUrl = () => useClientAssets()?.preview || null;
