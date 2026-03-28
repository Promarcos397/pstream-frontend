import React, { ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center p-4 text-white">
                    <h1 className="text-3xl font-bold mb-4">Something went wrong.</h1>
                    <p className="text-gray-400 mb-6 max-w-md text-center">
                        We're sorry, but the application encountered an unexpected error.
                    </p>
                    <div className="bg-[#242424] p-4 rounded text-left overflow-auto max-w-2xl w-full text-red-400 font-mono text-sm mb-6">
                        {this.state.error?.toString()}
                    </div>
                    <button
                        className="bg-red-600 px-6 py-2 rounded font-bold hover:bg-red-700 transition"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
