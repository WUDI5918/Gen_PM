
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                    <div className="bg-white p-8 rounded-xl shadow-lg max-w-2xl w-full border border-red-100">
                        <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100 mb-6">
                            <p className="font-mono text-sm text-red-800 break-all">
                                {this.state.error?.toString()}
                            </p>
                        </div>
                        {this.state.errorInfo && (
                            <details className="mb-6">
                                <summary className="text-sm font-medium text-gray-700 cursor-pointer mb-2">Stack Trace</summary>
                                <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-60 text-gray-600">
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                        >
                            Reload Application
                        </button>
                        <button
                            onClick={() => {
                                localStorage.clear();
                                // We might want to clear IndexedDB too but that requires async.
                                // For now let's just reload.
                                window.location.reload();
                            }}
                            className="ml-4 text-gray-500 hover:text-gray-700 underline text-sm"
                        >
                            Clear Local Storage & Reload
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
