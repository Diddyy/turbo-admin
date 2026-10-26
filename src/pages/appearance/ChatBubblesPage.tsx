import { useCanManageContent } from '#/api/content';
import { PageBody, PageHeader } from '#/components/ui';
import { ChatStylesTab } from '#/pages/content/ChatStylesTab';

/**
 * Appearance > Chat bubbles: the chat bubbles players speak in, with the rest of what a designer
 * changes - each drawn by the panel and by the game itself before it is saved, edited, copied, or
 * given new art. A theme brings its own as data (its `chatstyles/` folder).
 */
export const ChatBubblesPage = () => {
    const canManage = useCanManageContent();

    return (
        <>
            <PageHeader
                title="Chat bubbles"
                description="The bubbles players speak in: their art, shape, words and who may use each, drawn as the game draws them before you save. A theme plugin brings its own in its chatstyles folder."
            />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <ChatStylesTab canManage={canManage} />
            </PageBody>
        </>
    );
};
