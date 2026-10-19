import { useParams } from 'react-router';

import { useCanManageContent } from '#/api/content';
import { PageBody, PageHeader } from '#/components/ui';

import { AchievementsTab } from './AchievementsTab';
import { BadgesTab } from './BadgesTab';
import { BotsTab } from './BotsTab';
import { ChatStylesTab } from './ChatStylesTab';
import { CurrenciesTab } from './CurrenciesTab';
import { NavigatorTab } from './NavigatorTab';
import { PetsTab } from './PetsTab';

const TABS = [
    { value: 'achievements', label: 'Achievements' },
    { value: 'badges', label: 'Badges' },
    { value: 'navigator', label: 'Navigator' },
    { value: 'pets', label: 'Pets' },
    { value: 'bots', label: 'Bots' },
    { value: 'currencies', label: 'Currencies' },
    { value: 'chat-styles', label: 'Chat styles' },
].map(x => ({ ...x, to: `/content/${x.value}` }));

/**
 * The game's content: what players earn, wear, find and meet - achievements, badges, the
 * navigator, pets, bots and the currencies wallets hold. Each change is made at once.
 */
export const ContentPage = () => {
    const { tab: asked } = useParams();
    const tab = TABS.find(x => x.value === asked)?.value ?? 'achievements';
    const canManage = useCanManageContent();

    return (
        <>
            <PageHeader
                title="Content"
                description="Achievements, badges, the navigator, pets, bots and currencies"
                tabs={{ items: TABS, value: tab }}
            />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {tab === 'achievements' && <AchievementsTab />}
                {tab === 'badges' && <BadgesTab canManage={canManage} />}
                {tab === 'navigator' && <NavigatorTab canManage={canManage} />}
                {tab === 'pets' && <PetsTab canManage={canManage} />}
                {tab === 'bots' && <BotsTab canManage={canManage} />}
                {tab === 'currencies' && <CurrenciesTab canManage={canManage} />}
                {tab === 'chat-styles' && <ChatStylesTab canManage={canManage} />}
            </PageBody>
        </>
    );
};
