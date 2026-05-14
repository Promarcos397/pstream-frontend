import React, { ErrorInfo, ReactNode } from 'react';
import landingBg from '../assets/landing-bg.png';
import logo from '../assets/logos/pstream-logo.svg';

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
                <div className="relative min-h-screen bg-black flex flex-col font-['Consolas'] overflow-hidden selection:bg-red-600/30">
                    {/* Cinematic Background */}
                    <div className="absolute inset-0 z-0 pointer-events-none">
                        <img src={landingBg} className="w-full h-full object-cover opacity-60 scale-105" alt="background" />
                        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/10 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_80%)] opacity-60" />
                    </div>

                    <header className="relative z-10 px-6 md:px-14 lg:px-16 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
                        <div className="flex items-center justify-between">
                            <img 
                                src={logo} 
                                alt="Pstream" 
                                onClick={() => window.location.href = '/'}
                                className="h-4 sm:h-5 md:h-6 lg:h-7 cursor-pointer drop-shadow-md transition-transform hover:scale-105" 
                            />
                        </div>
                    </header>

                    <main className="relative z-10 flex-grow flex items-center justify-center px-6 py-12 text-center">
                        <div className="max-w-3xl w-full animate-fadeIn bg-black/60 backdrop-blur-md p-8 md:p-12 rounded-xl border border-white/10 shadow-2xl">
                            <div className="w-20 h-20 rounded-full border-[3px] border-[#e50914] flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(229,9,20,0.4)]">
                                <span className="text-[#e50914] text-4xl font-bold">!</span>
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black text-white mb-4 drop-shadow-lg tracking-tight">System Malfunction</h1>
                            <p className="text-lg text-white/70 mb-8 max-w-xl mx-auto font-sans leading-relaxed">
                                Our app encountered an unexpected anomaly. We've logged the error, but you'll need to restart your session to continue.
                            </p>
                            
                            <div className="bg-[#141414]/80 p-4 rounded-lg text-left overflow-auto w-full text-red-400 font-mono text-sm mb-8 border border-red-500/20 max-h-48">
                                {this.state.error?.toString()}
                            </div>

                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-8 py-4 bg-[#e50914] text-white text-lg font-bold rounded flex items-center justify-center gap-2 mx-auto hover:bg-[#f40612] transition-all shadow-xl hover:scale-[1.02] active:scale-95"
                            >
                                Reboot System
                            </button>
                        </div>
                    </main>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
