import { RotateCcw } from 'lucide-react';
import { Component, type ReactNode } from 'react';

import { Button, ErrorNotice, PageBody } from './ui';

interface State {
    error: Error | null;
}

/**
 * A page that throws while drawing: says so where the page was, and keeps the navigation, the
 * search and the rest of the panel working. The shell keys it by the path, so going to another
 * page starts it clean.
 */
export class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: unknown): State {
        return { error: error instanceof Error ? error : new Error(String(error)) };
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
