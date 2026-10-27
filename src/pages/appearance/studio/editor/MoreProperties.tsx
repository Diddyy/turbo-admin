import { Input, Labeled, Select, Switch } from '#/components/ui';
import { NumberField } from '#/preview/VisualEditor';

import { useStudio } from '../studio';
import { valuesOf } from './tree';
import type { WindowEditor } from './useWindowEditor';

type Op = Record<string, unknown>;

const isObject = (value: unknown): value is Op => (typeof value === 'object') && (value !== null) && !Array.isArray(value);

const Group = ({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) => (
    <fieldset className="flex flex-col gap-2 border-t border-line pt-2">
        <legend className="text-xs font-medium">{title}</legend>
        <p className="-mt-1 text-[11px] text-muted">{hint}</p>
        {children}
    </fieldset>
);

const LIMITS = [ 'Narrowest', 'Widest', 'Lowest', 'Tallest' ];

/**
 * The rest of what the engine lets a theme set on the picked element, beside the inspector's look,
 * place and text: its fill and opacity, size limits and how it follows a resize (Flash's layout
 * flags), and - on an element the theme added - its name, tags, clipping and the alpha a pixel
 * needs to take the mouse. Each explained; each a draft change, drawn at once.
 */
export const MoreProperties = ({ editor }: { editor: WindowEditor }) => {
    const studio = useStudio();
    const primary = editor.primary;

    if (!primary || !primary.node.parent) return null;

    const { tree, node } = primary;
    const values = valuesOf(tree, studio.ops(tree.template), node);
    const added = node.insertedAt !== undefined;
    const disabled = !studio.canManage;
    const drawn = (studio.selection?.element?.params ?? {}) as Op;
    const params = { ...(isObject(values.params) ? values.params : {}) };
    const param = (name: string) => (name in params ? params[name] : drawn[name]);
    const setParam = (name: string, value: unknown) => editor.setValues({ params: { ...params, [name]: value } }, `params.${name}`);
    const limits = (Array.isArray(values.limits) ? values.limits : [ null, null, null, null ]) as (number | null)[];
    const reflect = (Array.isArray(param('reflectToParent')) ? param('reflectToParent') : [ false, false ]) as [ boolean, boolean ];
    const shortName = node.name?.startsWith(`${tree.owner}:`) ? node.name.slice(tree.owner.length + 1) : node.name;

    return (
        <div className="flex flex-col gap-3 p-3 pt-0 text-sm" aria-label="More properties">
            <Group title="Fill and opacity" hint="A plain fill in the element's colour behind it, and how see-through all of it is.">
                <Switch label="Fill with its colour" checked={typeof values.background === 'boolean' ? values.background : false} disabled={disabled} onChange={on => editor.setValues({ background: on }, 'background')} />
                <Labeled label={`Opacity ${Math.round((typeof values.blend === 'number' ? values.blend : 1) * 100)}%`}>
                    <input type="range" aria-label="Opacity" min={0} max={1} step={0.05} disabled={disabled} value={typeof values.blend === 'number' ? values.blend : 1} onChange={event => editor.setValues({ blend: Number(event.target.value) }, 'blend')} className="w-full accent-[var(--color-accent)]" />
                </Labeled>
            </Group>
            <Group title="Size limits" hint="The smallest and largest it may be made as its window resizes. Empty: no limit.">
                <div className="grid grid-cols-2 gap-2">
                    {LIMITS.map((label, at) => (
                        <NumberField
                            key={label}
                            label={label}
                            value={limits[at] ?? undefined}
                            own={undefined}
                            onChange={(value) => {
                                const next = [ ...limits ];

                                next[at] = value ?? null;
                                editor.setValues({ limits: next.every(each => each === null) ? undefined : next }, 'limits');
                            }}
                        />
                    ))}
                </div>
            </Group>
            <Group title="When the window resizes" hint="Flash's layout flags: how the element follows what holds it and what it holds.">
                <Labeled label="Fits what it holds">
                    <Select aria-label="Fits what it holds" disabled={disabled} value={String(param('accommodate') ?? '')} onChange={event => setParam('accommodate', event.target.value || undefined)}>
                        <option value="">No: keeps its size</option>
                        <option value="expand">Grows to hold its children</option>
                        <option value="resize">Grows and shrinks to hold them</option>
                    </Select>
                </Labeled>
                <Switch label="Its own growth across grows its parent" checked={!!reflect[0]} disabled={disabled} onChange={on => setParam('reflectToParent', [ on, !!reflect[1] ])} />
                <Switch label="Its own growth down grows its parent" checked={!!reflect[1]} disabled={disabled} onChange={on => setParam('reflectToParent', [ !!reflect[0], on ])} />
                <Switch label="Stays inside its parent" checked={!!param('boundToParent')} disabled={disabled} onChange={on => setParam('boundToParent', on)} />
                <Switch label="Drawn in its parent's picture" hint="Use parent graphic context: drawn with its parent, not on its own." checked={!!param('parentGraphics')} disabled={disabled} onChange={on => setParam('parentGraphics', on)} />
                <Switch label="Cuts off what spills out" hint="Force clipping: its children are drawn only inside it." checked={!!param('forceClipping')} disabled={disabled} onChange={on => setParam('forceClipping', on)} />
                <Switch label="Shows its parent's caption" checked={!!param('inheritCaption')} disabled={disabled} onChange={on => setParam('inheritCaption', on)} />
            </Group>
            <Group title="Name, tags and mouse" hint={added ? 'This element is the theme\'s own: all of it can be set.' : 'Only on an element the theme added: the window\'s code finds its own elements by name and tag, so a theme leaves those.'}>
                <Labeled label="Name" hint={added ? 'What later changes name it by.' : undefined}>
                    <Input aria-label="Name" disabled={disabled || !added} value={shortName ?? ''} onChange={event => event.target.value && editor.setValues({ name: event.target.value }, 'name')} />
                </Labeled>
                <Labeled label="Tags" hint="Space between them.">
                    <Input aria-label="Tags" disabled={disabled || !added} value={node.tags.join(' ')} onChange={event => editor.setValues({ tags: event.target.value.split(/\s+/).filter(Boolean) }, 'tags')} />
                </Labeled>
                <Switch label="Clips its children" checked={typeof values.clipping === 'boolean' ? values.clipping : true} disabled={disabled || !added} onChange={on => editor.setValues({ clipping: on }, 'clipping')} />
                <NumberField label="Mouse threshold (alpha a pixel needs to take a click, 0-255)" value={values.mouseThreshold} own={10} onChange={value => added && editor.setValues({ mouseThreshold: value }, 'threshold')} />
            </Group>
        </div>
    );
};
