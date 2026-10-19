import type { CloseReason, ReportSanction, ReportSource } from '#/api/reports';

export const SOURCES: Record<ReportSource, string> = {
    room: 'Help window',
    im: 'Messenger',
    photo: 'Photo',
    forum: 'Group forum',
};

export const CLOSE_REASONS: Record<CloseReason, string> = {
    resolved: 'Resolved',
    useless: 'Useless',
    abusive: 'Abusive',
};

/** The default sanction as the mod action window names it. */
export const sanctionLabel = (sanction: ReportSanction) => {
    switch (sanction.name) {
        case 'ALERT':
            return 'a caution';
        case 'MUTE':
            return `a ${sanction.lengthHours}-hour mute`;
        case 'BAN_PERMANENT':
            return 'a permanent ban';
        case 'BAN':
            return sanction.lengthHours % 24 === 0 ? `a ${sanction.lengthHours / 24}-day ban` : `an ${sanction.lengthHours}-hour ban`;
        default:
            return sanction.name.toLowerCase();
    }
};
