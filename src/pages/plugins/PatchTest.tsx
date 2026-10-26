import { FlaskConical } from 'lucide-react';
import { useState } from 'react';

import { useTemplateIndex, windowOf } from '#/api/windows';
import { Button, ErrorNotice } from '#/components/ui';

import { testPatch } from './windowTest';
import { WindowTree } from './WindowTree';

/**
 * A patch's **Test**, before it is saved: the window's element tree from the client's index with
 * the ops applied - what each changed, and each op that names nothing, which clients would report
 * unmatched. Players' clients apply the saved patch themselves and report it beside the window.
 */
export const PatchTest = ({ template, ops }: { template: string; ops: readonly unknown[] }) => {
    const [ open, setOpen ] = useState(false);
    const { data: index, error } = useTemplateIndex();
    const found = index && windowOf(index, template);
    const result = open && found ? testPatch(found.elements, ops) : null;

    return (
        <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" icon={<FlaskConical />} disabled={!template} onClick={() => setOpen(!open)}>{open ? 'Hide test' : 'Test'}</Button>
                {open && index && !found && <span className="text-xs text-warn">{`The client has no window ${template}: check the template id on Plugins > Windows & skins.`}</span>}
                {result && <span className="text-xs text-muted">{`${result.applied.length} of ${ops.length} op(s) change the window, ${result.unmatched.length} match nothing.`}</span>}
            </div>
            {open && error && <ErrorNotice error={error} />}
            {result && (
                <div className="flex flex-col gap-1 rounded-lg border border-line p-3">
                    {result.unmatched.map(line => <p key={line} className="text-xs text-bad">{`Matches nothing - clients report it unmatched: ${line}`}</p>)}
                    {result.unknown.map(line => <p key={line} className="text-xs text-warn">{`Not an op the test reads: ${line}`}</p>)}
                    {result.applied.map(line => <p key={line} className="text-xs text-good">{line}</p>)}
                    {result.removed.length > 0 && <p className="text-xs text-muted">{`Removed: ${result.removed.join(', ')}`}</p>}
                    <WindowTree elements={result.elements} />
                </div>
            )}
        </div>
    );
};
