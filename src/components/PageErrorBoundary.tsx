import { RotateCcw } from 'lucide-react';
import { Component, type ReactNode } from 'react';

import { Button, ErrorNotice, PageBody } from './ui';

interface State {
    error: Error | null;
}

interface Props {
    children: ReactNode;
    /** The path: a page that threw starts clean once it changes. */
    resetKey: string;
}

/**
 * A page that throws while drawing: says so where the page was, and keeps the navigation, the
 * search and the rest of the panel working. Going to another path clears the error, while a page
 * that draws fine stays as it is when its own path moves on (a new notice opening at its key keeps
 * its draft): it isn't drawn again from nothing.
 */
export class PageErrorBoundary extends Component<Props, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: unknown): State {
        return { error: error instanceof Error ? error : new Error(String(error)) };
    }

    override componentDidUpdate(previous: Props) {
        if (this.state.error && previous.resetKey !== this.props.resetKey)
            this.setState({ error: null });
    }

    override render() {
        if (!this.state.error)
            return this.props.children;

        return (
            <PageBody className="flex flex-col items-start gap-3">
                <ErrorNotice error={new Error(`This page ran into a problem and stopped: ${this.state.error.message}`)} />
                <Button variant="secondary" icon={<RotateCcw />} onClick={() => this.setState({ error: null })}>Try again</Button>
            </PageBody>
        );
    }
}
