'use client';

import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

/**
 * Error Boundary component to catch and handle React errors gracefully
 * Particularly useful for catching Convex query errors and auth failures
 */
export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to console
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        // Call custom error handler if provided
        this.props.onError?.(error, errorInfo);

        // You could also send to error tracking service here (e.g., Sentry)
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return (
                <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
                    <div className="flex flex-col items-center gap-4 max-w-md text-center">
                        <div className="rounded-full bg-destructive/10 p-3">
                            <AlertCircle className="h-8 w-8 text-destructive" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold mb-2">
                                Something went wrong
                            </h2>
                            <p className="text-muted-foreground">
                                {this.state.error?.message || 'An unexpected error occurred'}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                onClick={() => window.location.reload()}
                                variant="outline"
                            >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Reload Page
                            </Button>
                            <Button onClick={this.handleReset}>
                                Try Again
                            </Button>
                        </div>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-4 w-full">
                                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                                    View error details
                                </summary>
                                <pre className="mt-2 text-xs bg-muted p-4 rounded-md overflow-auto max-h-60 text-left">
                                    {this.state.error.stack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Hook-based error boundary wrapper for convenience
 */
export function withErrorBoundary<P extends object>(
    Component: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <Component {...props} />
            </ErrorBoundary>
        );
    };
}
