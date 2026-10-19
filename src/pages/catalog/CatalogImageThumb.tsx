import { useQuery } from '@tanstack/react-query';
import { ImageOff } from 'lucide-react';

import { type CatalogImage, catalogImagePath } from '#/api/catalogImages';
import { cx } from '#/lib/cx';
import { apiImageQuery } from '#/preview/images';

/** The checks behind a picture, so its see-through parts show as such. */
export const CHECKS = 'bg-[repeating-conic-gradient(var(--color-subtle)_0_25%,transparent_0_50%)] bg-[length:12px_12px]';

/**
 * A catalog picture as this server has it - an upload shows before it is published - on checks,
 * fitted into the box; a picture with no file, or none picked, shows a mark instead.
 */
export const CatalogImageThumb = ({ image, className }: { image: Pick<CatalogImage, 'name' | 'updatedAtUtc' | 'hasFile'> | null; className?: string }) => {
    const path = image?.hasFile ? catalogImagePath(image) : null;
    const picture = useQuery(apiImageQuery(path));

    return (
        <span className={cx('grid shrink-0 place-items-center overflow-hidden rounded-lg border border-line', CHECKS, className)}>
            {picture.data
                ? <img src={picture.data.src} alt="" className="max-h-full max-w-full object-contain [image-rendering:pixelated]" />
                : image && (!path || picture.isError) && <ImageOff className="size-4 text-muted" aria-label="No picture on the server" />}
        </span>
    );
};
