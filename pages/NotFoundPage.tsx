import React from 'react';
import { useNavigate } from 'react-router-dom';
import landingBg from '../assets/landing-bg.png';
import logo from '../assets/logos/pstream-logo.svg';
import { CaretLeftIcon } from '@phosphor-icons/react';

interface NotFoundPageProps {
    title?: string;
    message?: string;
    code?: string;
}

const NotFoundPage: React.FC<NotFoundPageProps> = ({ 
    title = "Lost your way?", 
    message = "Sorry, we can't find that page. You'll find lots to explore on the home page.",
    code = "NSES-404"
}) => {
    const navigate = useNavigate();

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
                        onClick={() => navigate('/')}
                        className="h-4 sm:h-5 md:h-6 lg:h-7 cursor-pointer drop-shadow-md transition-transform hover:scale-105" 
                    />
                </div>
            </header>

            <main className="relative z-10 flex-grow flex items-center justify-center px-6 py-12 text-center">
                <div className="max-w-2xl w-full animate-fadeIn">
                    <h1 className="text-7xl md:text-9xl font-black text-white mb-6 drop-shadow-2xl opacity-90">404</h1>
                    <h2 className="text-2xl md:text-4xl font-bold text-white mb-6 drop-shadow-lg tracking-tight">{title}</h2>
                    <p className="text-lg md:text-xl text-white/70 mb-10 max-w-lg mx-auto font-sans">
                        {message}
                    </p>
                    <button
                        onClick={() => navigate('/')}
                        className="px-8 py-4 bg-white text-black text-lg font-bold rounded flex items-center justify-center gap-2 mx-auto hover:bg-white/90 transition-all shadow-xl hover:scale-[1.02] active:scale-95"
                    >
                        <CaretLeftIcon size={24} weight="bold" />
                        P-Stream Home
                    </button>
                    
                    <div className="mt-16 text-white/30 text-sm font-sans flex items-center justify-center gap-2">
                        <span className="h-px w-8 bg-white/20"></span>
                        <span>Error Code: {code}</span>
                        <span className="h-px w-8 bg-white/20"></span>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default NotFoundPage;
