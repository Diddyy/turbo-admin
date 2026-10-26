import { useParams } from 'react-router';

import { PageBody, PageHeader } from '#/components/ui';
import { FontsPanel, ImagesPanel } from '#/pages/plugins/ThemePage';

import { ThemePicker } from './ThemePicker';

/** A theme's images and fonts (its `wwwroot/styles/`), the hotel's by default: upload, copy the path a patch or style names, remove. */
export const ImagesPage = () => {
    const { key = 'hotel' } = useParams();

    return (
        <>
            <PageHeader title="Images" description="The art a theme's patches and image properties name: frame art, icons, backgrounds. Upload here, then pick it on Style properties or paste its path into a patch.">
                <ThemePicker value={key} to={next => `/appearance/images/${encodeURIComponent(next)}`} />
            </PageHeader>
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <ImagesPanel pluginKey={key} />
                <FontsPanel pluginKey={key} />
            </PageBody>
        </>
    );
};
