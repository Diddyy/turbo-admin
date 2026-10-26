import type { CatalogTree } from '#/api/catalog';

/** A row a window's code adds to a list, as the preview host draws it: the element cloned, its caption, what it shows. */
export interface DesignSampleRow {
    from: string;
    caption?: string;
    context: Record<string, string | number | boolean>;
}

interface SampleSources {
    catalog: CatalogTree | undefined;
    /** `catalog.icons.url`: `%name%` is the icon's number. */
    catalogIcon: string;
}

/**
 * The catalogue's tabs: a clone of `tab_button` per shown top-level page of this hotel's catalogue,
 * with the context `CatalogView` gives each (`pageId`, `pageName`, `icon`, `iconUrl`, `selected`), so
 * a patch's tab icons and item bindings draw as players see them.
 */
const catalogTabs = ({ catalog, catalogIcon }: SampleSources): Record<string, DesignSampleRow[]> => {
    const tabs = (catalog?.pages ?? [])
        .filter(page => (page.parentId === catalog?.rootId) && (page.display !== 'invisible') && (page.display !== 'bc_only'))
        .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id));

    return {
        tab_context: tabs.map((page, index) => ({
            from: 'tab_button',
            caption: page.localization || (page.name ?? ''),
            context: { pageId: page.id, pageName: page.name ?? '', icon: page.icon, iconUrl: catalogIcon.replace('%name%', String(page.icon)), selected: index === 0 },
        })),
    };
};

/**
 * The frame id a window's code gives its frame, by template: what a `frame.overrides` entry (a theme
 * style's variable) names the window by. nitro-next's `CatalogView` (`getCatalogWindowName`, the normal
 * catalogue's) and `NavigatorView`.
 */
const FRAME_IDS: Record<string, string> = {
    'habbo-catalog-com/catalog_ubuntu_with_tabs': 'catalog',
    'habbo-new-navigator/navigator_frame_2_xml': 'navigator',
};

/** The frame id a template's window is drawn with in the game, when its code gives one. */
export const designFrameId = (template: string): string | undefined => FRAME_IDS[template];

/** The template a `frame.overrides` entry's window is drawn from, when one is. */
export const designTemplateOfFrame = (frameId: string): string | undefined => Object.keys(FRAME_IDS).find(template => FRAME_IDS[template] === frameId);

/** Per window, the rows its code would add to its lists: what the preview draws with no server to fill them. */
const SAMPLES: Record<string, (sources: SampleSources) => Record<string, DesignSampleRow[]>> = {
    'habbo-catalog-com/catalog_ubuntu_with_tabs': catalogTabs,
};

export const designSamples = (template: string, sources: SampleSources): Record<string, DesignSampleRow[]> => SAMPLES[template]?.(sources) ?? {};
