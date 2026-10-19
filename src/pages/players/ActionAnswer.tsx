import { CommandAnswer } from '#/components/CommandAnswer';
import { ErrorNotice } from '#/components/ui';

import type { PlayerAction } from './usePlayerAction';

/** What the last action answered: its lines, or why it did not run. */
export const ActionAnswer = ({ action }: { action: PlayerAction }) => (
    <>
        {action.act.error && <ErrorNotice error={action.act.error} />}
        {action.act.data && <CommandAnswer response={action.act.data} onConfirm={action.confirmPending} busy={action.busy} />}
    </>
);
