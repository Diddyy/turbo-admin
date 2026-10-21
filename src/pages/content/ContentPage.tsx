import { useCanManageContent } from '#/api/content';
import { PageBody, PageHeader } from '#/components/ui';
import { usePathTab } from '#/lib/tabs';

import { AchievementsTab } from './AchievementsTab';
import { BadgesTab } from './BadgesTab';
import { ChatStylesTab } from './ChatStylesTab';
import { CurrenciesTab } from './CurrenciesTab';
import { DailyTasksTab } from './DailyTasksTab';
import { NavigatorTab } from './NavigatorTab';
import { PetsTab } from './PetsTab';
import { PollsTab } from './PollsTab';
import { QuestsTab } from './QuestsTab';

const TABS = [
    { value: 'achievements', label: 'Achievements' },
    { value: 'badges', label: 'Badges' },
    { value: 'navigator', label: 'Navigator' },
    { value: 'pets', label: 'Pets' },
    { value: 'currencies', label: 'Currencies' },
    { value: 'chat-styles', label: 'Chat styles' },
    { value: 'daily-tasks', label: 'Daily tasks' },
    { value: 'quests', label: 'Quests' },
    { value: 'polls', label: 'Room polls' },
].map(x => ({ ...x, to: `/content/${x.value}` }));

/**
 * The game's content: what players earn, wear, find and meet - achievements, badges, the
 * navigator, pets, the currencies wallets hold, and the daily tasks, quests and room
 * polls players do.
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
                description="Achievements, badges, the navigator, pets, currencies, daily tasks, quests and room polls"
                tabs={{ items: TABS, value: tab }}
            />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                {tab === 'achievements' && <AchievementsTab />}
                {tab === 'badges' && <BadgesTab canManage={canManage} />}
                {tab === 'navigator' && <NavigatorTab canManage={canManage} />}
                {tab === 'pets' && <PetsTab canManage={canManage} />}
                {tab === 'currencies' && <CurrenciesTab canManage={canManage} />}
                {tab === 'chat-styles' && <ChatStylesTab canManage={canManage} />}
                {tab === 'daily-tasks' && <DailyTasksTab />}
                {tab === 'quests' && <QuestsTab />}
                {tab === 'polls' && <PollsTab />}
            </PageBody>
        </>
    );
};
