import { useMemo, useState } from 'react';

import { useClientAssets } from '#/api/assets';
import { useClientImages, useClientImageUrl, useHabboNotices, useHabboNoticeTexts } from '#/api/notices';

import { descKey, type NoticeSet, parseNotices } from './model';

/** How the client takes `static_bitmap.assetUri`: an address when it has a `/` or a `$`, else one of its own images by name. */
export const isImageAddress = (image: string) => image.includes('/') || image.includes('$');

/** An image address with `${image.library.url}` filled in as the client's; null while it can't be. */
export const useImageAddress = (image: string) => {
    const assets = useClientAssets();
    const resolved = image.trim().replaceAll('${image.library.url}', assets?.imageLibrary ?? '${image.library.url}');

    if (!resolved || resolved.includes('${')) return null;

    return resolved.startsWith('//') ? `https:${resolved}` : resolved;
};

/**
 * A notice's picture as the client finds it: an address loaded as it is (`${image.library.url}`
 * filled in), or one of the client's own images by name, from the bundle the client loads it from.
 * `missing` is a name the client has no image for, or an address that didn't load.
 */
export const useNoticeImage = (image: string) => {
    const value = image.trim();
    const address = isImageAddress(value);
    const url = useImageAddress(address ? value : '');
    const { data: images, isError } = useClientImages();
    const own = useClientImageUrl(!address && value ? value : null);
    const [ broken, setBroken ] = useState<string | null>(null);

    if (!value) return { url: null, missing: false, onError: undefined };

    if (address) return { url, missing: broken === url, onError: () => setBroken(url) };

    return { url: own, missing: (!!images && !images.has(value)) || isError, onError: undefined };
};

/**
 * Habbo's notices as its external variables have them now, read from Habbo once asked for (and
 * not again on its own), with their words from the newest of Habbo's texts the hotel has found.
 * `wordsKnown`: Habbo's texts have been found, so a notice without words has none at Habbo either.
 */
export const useHabboSet = (enabled: boolean) => {
    const { data: preview, error, isFetching } = useHabboNotices(enabled);
    const parsed = useMemo(() => parseNotices(Object.fromEntries((preview?.variables ?? []).map(x => [ x.key, x.value ])), {}), [ preview ]);
    const textKeys = useMemo(() => parsed.notices.map(x => descKey(x.key)), [ parsed ]);
    const { data: texts, error: textsError } = useHabboNoticeTexts(textKeys, enabled && !!preview);
    const wordsKnown = !!texts?.checkedAt;
    const habbo = useMemo<NoticeSet | null>(() => {
        if (!preview) return null;

        const words = new Map((texts?.texts ?? []).map(x => [ x.key, x.value ]));

        return { active: parsed.active, notices: parsed.notices.map(x => ({ ...x, texts: { ...x.texts, desc: words.get(descKey(x.key)) ?? '' } })) };
    }, [ preview, parsed, texts ]);

    return { habbo, domain: preview?.domain ?? null, wordsKnown, checkedAt: texts?.checkedAt ?? null, textsLoaded: !!texts, error: error ?? textsError, isFetching };
};
