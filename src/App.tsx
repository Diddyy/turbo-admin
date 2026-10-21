import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { LoginPage } from '#/auth/LoginPage';
import { RequireSession } from '#/auth/RequireSession';
import { SetupPage } from '#/auth/SetupPage';
import { ToTab } from '#/components/ToTab';
import { Loading } from '#/components/ui';
import { Shell } from '#/layout/Shell';
import { AccountPage } from '#/pages/AccountPage';
import { CatalogPage } from '#/pages/catalog/CatalogPage';
import { DiscountsPage } from '#/pages/catalog/DiscountsPage';
import { SongsPage } from '#/pages/catalog/SongsPage';
import { VouchersPage } from '#/pages/catalog/VouchersPage';
import { ChatlogPage } from '#/pages/ChatlogPage';
import { CommandLogPage } from '#/pages/CommandLogPage';
import { ConsolePage } from '#/pages/ConsolePage';
import { ContentPage } from '#/pages/content/ContentPage';
import { CurrencyLogPage } from '#/pages/CurrencyLogPage';
import { DashboardPage } from '#/pages/DashboardPage';
import { LibraryPage } from '#/pages/gamedata/LibraryPage';
import { PublishPage } from '#/pages/gamedata/PublishPage';
import { TextsPage } from '#/pages/gamedata/TextsPage';
import { UpdatesPage } from '#/pages/gamedata/UpdatesPage';
import { BadgePartsPage } from '#/pages/groups/BadgePartsPage';
import { GroupPage as GuildPage } from '#/pages/groups/GroupPage';
import { GroupsPage as GuildsPage } from '#/pages/groups/GroupsPage';
import { HotelViewPage } from '#/pages/hotel-view/HotelViewPage';
import { MessagesPage } from '#/pages/MessagesPage';
import { NoticesPage } from '#/pages/notices/NoticesPage';
import { OnlineRewardsPage } from '#/pages/online-rewards/OnlineRewardsPage';
import { GroupPage } from '#/pages/permissions/GroupPage';
import { GroupsPage } from '#/pages/permissions/GroupsPage';
import { LogPage, NodesPage, SearchPage } from '#/pages/permissions/LookupPages';
import { PlayerPage } from '#/pages/permissions/PlayerPage';
import { PlayersPage } from '#/pages/permissions/PlayersPage';
import { PlayerPage as PlayerProfilePage } from '#/pages/players/PlayerPage';
import { PlayersPage as PlayerListPage } from '#/pages/players/PlayersPage';
import { PluginPage } from '#/pages/plugins/PluginPage';
import { PluginsPage } from '#/pages/PluginsPage';
import { ReportPage } from '#/pages/reports/ReportPage';
import { ReportsPage } from '#/pages/reports/ReportsPage';
import { WordFilterPage } from '#/pages/reports/WordFilterPage';
import { RewardTracksPage } from '#/pages/reward-tracks/RewardTracksPage';
import { RoomPage } from '#/pages/rooms/RoomPage';
import { RoomSettingsPage } from '#/pages/rooms/RoomSettingsPage';
import { RoomsPage } from '#/pages/rooms/RoomsPage';
import { RoomVisitsPage } from '#/pages/RoomVisitsPage';
import { SettingsPage } from '#/pages/settings/SettingsPage';
import { StaffPage } from '#/pages/StaffPage';

// Their charts are a large library that no other page needs, so they load when opened.
const PerformancePage = lazy(() => import('#/pages/PerformancePage').then(x => ({ default: x.PerformancePage })));
const ClientHealthPage = lazy(() => import('#/pages/telemetry/ClientHealthPage').then(x => ({ default: x.ClientHealthPage })));
const UsagePage = lazy(() => import('#/pages/telemetry/UsagePage').then(x => ({ default: x.UsagePage })));
const TelemetryRoomPage = lazy(() => import('#/pages/telemetry/TelemetryDrillPages').then(x => ({ default: x.TelemetryRoomPage })));
const TelemetryPlayerPage = lazy(() => import('#/pages/telemetry/TelemetryDrillPages').then(x => ({ default: x.TelemetryPlayerPage })));

export const App = () => (
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route element={<RequireSession><Shell /></RequireSession>}>
            <Route index element={<DashboardPage />} />
            <Route path="performance" element={<Suspense fallback={<Loading />}><PerformancePage /></Suspense>} />
            <Route path="client-health" element={<Suspense fallback={<Loading />}><ClientHealthPage /></Suspense>} />
            <Route path="client-health/rooms/:id" element={<Suspense fallback={<Loading />}><TelemetryRoomPage /></Suspense>} />
            <Route path="client-health/players/:id" element={<Suspense fallback={<Loading />}><TelemetryPlayerPage /></Suspense>} />
            <Route path="usage" element={<Suspense fallback={<Loading />}><UsagePage /></Suspense>} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="rooms/:id" element={<ToTab to="overview" />} />
            <Route path="rooms/:id/overview" element={<RoomPage />} />
            <Route path="rooms/:id/settings" element={<RoomSettingsPage />} />
            <Route path="players" element={<PlayerListPage />} />
            <Route path="players/:id/:tab?" element={<PlayerProfilePage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/:id" element={<ReportPage />} />
            <Route path="word-filter" element={<WordFilterPage />} />
            <Route path="groups" element={<GuildsPage />} />
            <Route path="groups/badge-parts" element={<BadgePartsPage />} />
            <Route path="groups/:id" element={<GuildPage />} />
            <Route path="catalog" element={<ToTab to="editor" />} />
            <Route path="catalog/:view/:sub?" element={<CatalogPage />} />
            <Route path="catalog/vouchers" element={<VouchersPage />} />
            <Route path="catalog/songs" element={<SongsPage />} />
            <Route path="catalog/discounts" element={<DiscountsPage />} />
            <Route path="gamedata" element={<ToTab to="updates/waiting" />} />
            <Route path="gamedata/updates/:tab?" element={<UpdatesPage />} />
            <Route path="gamedata/library/:tab?" element={<LibraryPage />} />
            <Route path="gamedata/publish/:tab?" element={<PublishPage />} />
            {/* Products, texts and variables: the files the client reads, each by its name. */}
            <Route path="gamedata/:tab" element={<TextsPage />} />
            <Route path="hotel-view/:group?/:view?" element={<HotelViewPage />} />
            <Route path="notices" element={<NoticesPage />} />
            <Route path="reward-tracks" element={<RewardTracksPage />} />
            <Route path="reward-tracks/import" element={<RewardTracksPage importing />} />
            <Route path="reward-tracks/:id/:tab?" element={<RewardTracksPage />} />
            <Route path="online-rewards" element={<OnlineRewardsPage />} />
            <Route path="content/:tab?" element={<ContentPage />} />
            <Route path="settings/:tab?" element={<SettingsPage />} />
            <Route path="plugins" element={<PluginsPage />} />
            <Route path="plugin/:key/:page" element={<PluginPage />} />
            <Route path="plugin/:key/:page/:id" element={<PluginPage />} />
            <Route path="command-log" element={<CommandLogPage />} />
            <Route path="chatlog" element={<ChatlogPage />} />
            <Route path="messages" element={<MessagesPage />} />
            <Route path="currency-log" element={<CurrencyLogPage />} />
            <Route path="room-visits" element={<RoomVisitsPage />} />
            <Route path="permission-log" element={<LogPage />} />
            <Route path="console" element={<ConsolePage />} />
            <Route path="permissions" element={<ToTab to="groups" />} />
            <Route path="permissions/groups" element={<GroupsPage />} />
            <Route path="permissions/groups/:name" element={<GroupPage />} />
            <Route path="permissions/players" element={<PlayersPage />} />
            <Route path="permissions/players/:id" element={<PlayerPage />} />
            <Route path="permissions/search" element={<SearchPage />} />
            <Route path="permissions/nodes" element={<NodesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);
