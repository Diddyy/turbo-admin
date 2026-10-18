import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { LoginPage } from '#/auth/LoginPage';
import { RequireSession } from '#/auth/RequireSession';
import { SetupPage } from '#/auth/SetupPage';
import { Loading } from '#/components/ui';
import { Shell } from '#/layout/Shell';
import { AccountPage } from '#/pages/AccountPage';
import { CatalogPage } from '#/pages/catalog/CatalogPage';
import { SongsPage } from '#/pages/catalog/SongsPage';
import { VouchersPage } from '#/pages/catalog/VouchersPage';
import { ChatlogPage } from '#/pages/ChatlogPage';
import { CommandLogPage } from '#/pages/CommandLogPage';
import { ConsolePage } from '#/pages/ConsolePage';
import { ContentPage } from '#/pages/content/ContentPage';
import { DashboardPage } from '#/pages/DashboardPage';
import { LibraryPage } from '#/pages/gamedata/LibraryPage';
import { PublishPage } from '#/pages/gamedata/PublishPage';
import { TextsPage } from '#/pages/gamedata/TextsPage';
import { AssetsRedirect, GamedataRoute } from '#/pages/gamedata/UpdatesPage';
import { BadgePartsPage } from '#/pages/groups/BadgePartsPage';
import { GroupPage as GuildPage } from '#/pages/groups/GroupPage';
import { GroupsPage as GuildsPage } from '#/pages/groups/GroupsPage';
import { HotelViewPage } from '#/pages/hotel-view/HotelViewPage';
import { GroupPage } from '#/pages/permissions/GroupPage';
import { GroupsPage } from '#/pages/permissions/GroupsPage';
import { LogPage, NodesPage, SearchPage } from '#/pages/permissions/LookupPages';
import { PlayerPage } from '#/pages/permissions/PlayerPage';
import { PlayersPage } from '#/pages/permissions/PlayersPage';
import { PlayerPage as PlayerProfilePage } from '#/pages/players/PlayerPage';
import { PlayersPage as PlayerListPage } from '#/pages/players/PlayersPage';
import { PluginPage } from '#/pages/plugins/PluginPage';
import { PluginsPage } from '#/pages/PluginsPage';
import { RewardTracksPage } from '#/pages/reward-tracks/RewardTracksPage';
import { RoomPage } from '#/pages/rooms/RoomPage';
import { RoomSettingsPage } from '#/pages/rooms/RoomSettingsPage';
import { RoomsPage } from '#/pages/rooms/RoomsPage';
import { SettingsPage } from '#/pages/settings/SettingsPage';
import { StaffPage } from '#/pages/StaffPage';

// Its charts are a large library that no other page needs, so it loads when opened.
const PerformancePage = lazy(() => import('#/pages/PerformancePage').then(x => ({ default: x.PerformancePage })));

export const App = () => (
    <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route element={<RequireSession><Shell /></RequireSession>}>
            <Route index element={<DashboardPage />} />
            <Route path="performance" element={<Suspense fallback={<Loading />}><PerformancePage /></Suspense>} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="rooms/:id" element={<RoomPage />} />
            <Route path="rooms/:id/settings" element={<RoomSettingsPage />} />
            <Route path="players" element={<PlayerListPage />} />
            <Route path="players/:id" element={<PlayerProfilePage />} />
            <Route path="groups" element={<GuildsPage />} />
            <Route path="groups/badge-parts" element={<BadgePartsPage />} />
            <Route path="groups/:id" element={<GuildPage />} />
            <Route path="catalog" element={<CatalogPage />} />
            <Route path="catalog/songs" element={<SongsPage />} />
            <Route path="vouchers" element={<VouchersPage />} />
            <Route path="gamedata" element={<GamedataRoute />} />
            <Route path="gamedata/library" element={<LibraryPage />} />
            <Route path="gamedata/texts" element={<TextsPage />} />
            <Route path="gamedata/publish" element={<PublishPage />} />
            <Route path="assets" element={<AssetsRedirect />} />
            <Route path="hotel-view" element={<HotelViewPage />} />
            <Route path="reward-tracks" element={<RewardTracksPage />} />
            <Route path="content" element={<ContentPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="plugins" element={<PluginsPage />} />
            <Route path="plugin/:key/:page" element={<PluginPage />} />
            <Route path="plugin/:key/:page/:id" element={<PluginPage />} />
            <Route path="command-log" element={<CommandLogPage />} />
            <Route path="chatlog" element={<ChatlogPage />} />
            <Route path="console" element={<ConsolePage />} />
            <Route path="permissions" element={<Navigate to="/permissions/groups" replace />} />
            <Route path="permissions/groups" element={<GroupsPage />} />
            <Route path="permissions/groups/:name" element={<GroupPage />} />
            <Route path="permissions/players" element={<PlayersPage />} />
            <Route path="permissions/players/:id" element={<PlayerPage />} />
            <Route path="permissions/search" element={<SearchPage />} />
            <Route path="permissions/log" element={<LogPage />} />
            <Route path="permissions/nodes" element={<NodesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="account" element={<AccountPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
);
