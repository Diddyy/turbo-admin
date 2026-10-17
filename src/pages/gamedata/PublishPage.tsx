import { useAssetJob } from '#/api/bundles';
import { PageBody, PageHeader } from '#/components/ui';
import { useFoundChecks } from '#/pages/assets/checkLists';
import { Checks } from '#/pages/assets/Checks';
import { JobPanel } from '#/pages/assets/JobPanel';
import { PublishTab } from '#/pages/assets/PublishTab';

import { ClientFiles } from './ClientFiles';
import { Loaded, RunningJob } from './frame';
import { useGamedata, useTab } from './state';

const TABS = [ 'targets', 'files', 'checks' ] as const;

/**
 * Getting it to players: the targets the bundles are published to, the gamedata files the client
 * loads (built from the database), and the checks of the bundles against what the hotel has.
 */
export const PublishPage = () => {
    const state = useGamedata();
    const [ tab, setTab ] = useTab(TABS);
    const { data: job } = useAssetJob();
    const { items: found } = useFoundChecks();
    const running = job?.status === 'running';

    return (
        <>
            <PageHeader
                title="Publish"
                description="Where the bundles go, and the files the client loads"
                tabs={{
                    items: [
                        { value: 'targets', label: 'Targets' },
                        { value: 'files', label: 'Client files' },
                        { value: 'checks', label: 'Checks', ...(found.length > 0 ? { count: found.length } : {}) },
                    ],
                    value: tab,
                    onChange: setTab,
                }}
            />
            <PageBody className="flex flex-col gap-4 lg:gap-5">
                <Loaded state={state}>
                    {(status, assets) => (
                        <>
                            {/* On Targets, the last publish however it ended, so one that failed says why; elsewhere only one running. */}
                            {tab === 'targets' && job && (running || job.kind === 'publish') ? <JobPanel job={job} canManage={assets.canManage} compact={running} /> : <RunningJob canManage={assets.canManage} />}
                            {tab === 'targets' && <PublishTab canManage={assets.canManage} busy={running} />}
                            {tab === 'files' && <ClientFiles status={status} />}
                            {tab === 'checks' && <Checks />}
                        </>
                    )}
                </Loaded>
            </PageBody>
        </>
    );
};
