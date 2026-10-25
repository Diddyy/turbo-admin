import { useSession } from '#/auth/session';

/**
 * The admin API. Empty means the panel's own origin, which is how it is deployed (the panel's
 * site proxies `/api` to Turbo) and how it runs in development (Vite proxies it the same way).
 * Set `VITE_API_URL` only when the API lives somewhere else.
 */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
    readonly status: number;
    /** The server's whole answer, for an endpoint that says more than its message (the field it is about). */
    readonly body: Record<string, unknown> | null;

    constructor(status: number, message: string, body: Record<string, unknown> | null = null) {
        super(message);
        this.status = status;
        this.body = body;
    }
}

export const MESSAGES: Record<number, string> = {
    400: 'The server could not use that request.',
    401: 'Your session has ended. Sign in again.',
    403: 'You do not have access to the admin panel.',
    // An upload over its limit says which; a bare 413 is most often the site's nginx, set lower than that.
    413: 'That is too large to send. If the site\'s nginx refused it, raise client_max_body_size in its /api/ block, as scripts/ploi/nginx.conf has it.',
    429: 'Too many attempts. Wait a minute and try again.',
    500: 'The server ran into a problem. It is in the server log.',
};

/** The server's own explanation, when it gave one (`{ "message": "..." }`), and the rest it said. */
const explanationOf = async (response: Response) => {
    try {
        const body = (await response.json()) as Record<string, unknown>;

        return { message: typeof body.message === 'string' ? body.message : null, body };
    } catch {
        return { message: null, body: null };
    }
};

/**
 * Calls the admin API as the signed-in player. A 401 on a signed-in request means the session is
 * gone (expired, signed out elsewhere, or the server restarted), so it is dropped and the app
 * returns to sign-in.
 */
export const api = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = useSession.getState().session?.token;
    const headers = new Headers(init.headers);

    if (init.body !== undefined)
        headers.set('Content-Type', 'application/json');

    if (token)
        headers.set('Authorization', `Bearer ${token}`);

    let response: Response;

    try {
        response = await fetch(`${API_URL}/api${path}`, { ...init, headers });
    } catch {
        throw new ApiError(0, 'Cannot reach the admin API. Is the server running with Turbo:Admin:Enabled?');
    }

    if (response.status === 401 && token)
        useSession.getState().signOut();

    if (!response.ok) {
        const answer = await explanationOf(response);

        throw new ApiError(response.status, answer.message ?? MESSAGES[response.status] ?? `The server answered ${response.status}.`, answer.body);
    }

    if (response.status === 204)
        return undefined as T;

    if (response.status === 202) {
        const started = (await response.json()) as Partial<JobStarted>;

        if (typeof started.poll === 'string')
            return answerOf<T>(started.poll);

        return started as T;
    }

    return (await response.json()) as T;
};

/** Work that outlasted its request: where to ask after it. */
interface JobStarted {
    job: string;
    title: string;
    poll: string;
}

/** A job as the server reports it; once done, what its request would have answered. */
interface Job {
    id: string;
    title: string;
    done: boolean;
    answerStatus: number | null;
    answer: unknown;
}

/** How long to wait between asking after a job. */
const JOB_POLL_MS = 1500;

/**
 * Asks after a job until it is done, then answers as its request would have: the body, or the
 * error. Each ask is short, so a proxy's timeout never cuts long work off.
 */
const answerOf = async <T>(poll: string): Promise<T> => {
    for (;;) {
        await new Promise(resolve => setTimeout(resolve, JOB_POLL_MS));

        const job = await api<Job>(poll);

        if (!job.done)
            continue;

        const status = job.answerStatus ?? 200;

        if (status >= 200 && status < 300)
            return (status === 204 ? undefined : job.answer) as T;

        const message = (job.answer as { message?: unknown } | null)?.message;

        throw new ApiError(status, typeof message === 'string' ? message : MESSAGES[status] ?? `The server answered ${status}.`);
    }
};

/**
 * A file from the admin API as the signed-in player, as a blob: for an image the page draws, which
 * an `<img>` cannot fetch with the session's token, or a download.
 */
export const apiBlob = async (path: string, body?: unknown): Promise<Blob> => {
    const token = useSession.getState().session?.token;
    let response: Response;

    try {
        // With a body, it is POSTed as JSON: a file the server makes from what is asked (a plugin package).
        response = await fetch(`${API_URL}/api${path}`, {
            ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        });
    } catch {
        throw new ApiError(0, 'Cannot reach the admin API. Is the server running with Turbo:Admin:Enabled?');
    }

    if (response.status === 401 && token)
        useSession.getState().signOut();

    if (!response.ok)
        throw new ApiError(response.status, (await explanationOf(response)).message ?? MESSAGES[response.status] ?? `The server answered ${response.status}.`);

    return response.blob();
};

export const post = <T>(path: string, body?: unknown) =>
    api<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const put = <T>(path: string, body: unknown) =>
    api<T>(path, { method: 'PUT', body: JSON.stringify(body) });

export const remove = <T>(path: string) => api<T>(path, { method: 'DELETE' });
