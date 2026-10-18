import { useClientAssets } from '#/api/assets';
import { useHotelViewTexts } from '#/api/hotelView';

/** The tracks' names, from the hotel's texts (`reward_track.<id>.name`), where it has them. */
export const useTrackNames = (ids: string[]) => {
    const { data } = useHotelViewTexts(ids.map(id => `reward_track.${id}.name`));

    return new Map((data?.texts ?? []).map(x => [ x.key.slice('reward_track.'.length, -'.name'.length), x.value ]));
};

/** The client's preview host for this panel (`/client/assets` `preview`), or null when the hotel names none. */
export const useGamePreviewUrl = () => useClientAssets()?.preview || null;
