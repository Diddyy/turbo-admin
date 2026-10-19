import { useCanManageContent } from '#/api/content';
import { PageBody, PageHeader } from '#/components/ui';
import { usePathTab } from '#/lib/tabs';

import { AchievementsTab } from './AchievementsTab';
import { BadgesTab } from './BadgesTab';
import { BotsTab } from './BotsTab';
import { ChatStylesTab } from './ChatStylesTab';
import { CurrenciesTab } from './CurrenciesTab';
import { DailyTasksTab } from './DailyTasksTab';
import { NavigatorTab } from './NavigatorTab';
import { PetsTab } from './PetsTab';
import { QuestsTab } from './QuestsTab';

const TABS = [
    { value: 'achievements', label: 'Achievements' },
    { value: 'badges', label: 'Badges' },
    { value: 'navigator', label: 'Navigator' },
    { value: 'pets', label: 'Pets' },
    { value: 'bots', label: 'Bots' },
    { value: 'currencies', label: 'Currencies' },
    { value: 'chat-styles', label: 'Chat styles' },
    { value: 'daily-tasks', label: 'Daily tasks' },
    { value: 'quests', label: 'Quests' },
].map(x => ({ ...x, to: `/content/${x.value}` }));

/**
 * The game's content: what players earn, wear, find and meet - achievements, badges, the
 * navigator, pets, bots, the currencies wallets hold, and the daily tasks and quests players do.
 * Each change is made at once.
 */
export const ContentPage = () => {
    const [ tab, toTab ] = usePathTab(TABS.map(x => x.value));
    const canManage = useCanManageContent();

    if (toTab)
        return toTab;

    return (
        <>
            <PageHeader
                title="Content"
                description="Achievements, badges, the navigator, pets, bots, currencies, daily tasks and quests"
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
                {tab === 'daily-tasks' && <DailyTasksTab />}
                {tab === 'quests' && <QuestsTab />}
            </PageBody>
        </>
    );
};
