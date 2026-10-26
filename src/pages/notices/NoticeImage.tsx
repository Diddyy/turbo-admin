import { ImageOff, TriangleAlert } from 'lucide-react';

import type { ImageAccept } from '#/api/media';
import { ImageInput } from '#/components/ImageInput';
import { Badge } from '#/components/ui';
import { cx } from '#/lib/cx';

import { CHECKS } from '../catalog/CatalogImageThumb';
import { isImageAddress, useNoticeImage } from './hooks';

/**
 * What a notice's picture can be: one of the client's own images by name (the
 * `habbo-window-manager-com` bundle's), an address under the client's image library
 * (`${image.library.url}album1584/ACH_LegDay20.png`), or a full one.
 */
const NOTICE_IMAGE: ImageAccept = { shapes: [ 'clientImage', 'libraryUrl', 'url' ], usedIn: 'notice' };

/** A notice's picture, picked in the image picker, drawn as the client finds it, with a warning when the client can't. */
export const NoticeImage = ({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) => {
    const image = value.trim();
    const current = useNoticeImage(image);

    return (
        <div className="flex items-center gap-2">
            <span className={cx('grid size-12 shrink-0 place-items-center overflow-hidden rounded', CHECKS)}>
                {current.url && !current.missing
                    ? <img src={current.url} alt="" onError={current.onError} className="max-h-full max-w-full [image-rendering:pixelated]" />
                    : current.missing ? <TriangleAlert className="size-5 text-warn" /> : <ImageOff className="size-5 text-muted" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <ImageInput value={image} onChange={onChange} accept={NOTICE_IMAGE} title="The notice's picture" preview={false} disabled={disabled} />
                {image && (
                    <span className="flex flex-wrap gap-1" data-testid="notice-image-value" data-value={image}>
                        <Badge>{isImageAddress(image) ? 'address' : 'client image'}</Badge>
                        {current.missing && <Badge tone="amber">{isImageAddress(image) ? 'doesn\'t load' : 'the client has no image by this name'}</Badge>}
                    </span>
                )}
            </span>
        </div>
    );
};
