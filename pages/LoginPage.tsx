import React, { useState, useEffect, useRef } from 'react';
import { useGlobalContext } from '../context/GlobalContext';
import { AuthService } from '../services/AuthService';
import { ArrowLeftIcon, InfoIcon, CopyIcon, DownloadIcon, ShieldCheckIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logo from '../assets/pstream-logo.png';
import landingBg from '../assets/landing-bg.png';
import * as bip39 from 'bip39';

const LoginPage: React.FC = () => {
    const { login, syncStatus, user, updateSettings } = useGlobalContext();
    const { t } = useTranslation();
    const [view, setView] = useState<'landing' | 'signin' | 'create-name' | 'savekey'>('landing');
    const [mnemonic, setMnemonic] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [newMnemonic, setNewMnemonic] = useState<string | null>(null);
    const [showInfo, setShowInfo] = useState(false);
    const navigate = useNavigate();
    
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (user) navigate('/');
    }, [user, navigate]);

    const handleLogin = async (e?: React.FormEvent, customMnemonic?: string) => {
        if (e) e.preventDefault();
        setError('');
        
        const phrase = (customMnemonic || mnemonic).trim().toLowerCase();
        if (!phrase) {
            setError(t('auth.invalidKey', { defaultValue: 'Please enter your recovery phrase' }));
            return;
        }

        // Frontend BIP39 validation — rejects random/invalid words before hitting the backend
        const isSignUp = view === 'savekey';
        if (!isSignUp) {
            const words = phrase.split(/\s+/);
            if (words.length !== 12) {
                setError('Recovery phrase must be exactly 12 words.');
                return;
            }
            if (!bip39.validateMnemonic(phrase)) {
                setError('Invalid recovery phrase. Please check the words and try again.');
                return;
            }
        }
        const result = await login(phrase, displayName.trim(), isSignUp);
        if (!result.success) {
            setError(result.error || t('auth.invalidKey', { defaultValue: 'Login failed' }));
        } else {
            if (isSignUp && formRef.current) {
                const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
                formRef.current.dispatchEvent(submitEvent);
            }
            navigate('/');
        }
    };

    const changeView = (newView: typeof view) => {
        setError('');
        setDisplayName('');
        setMnemonic('');
        setView(newView);
    };

    const handleStartCreation = () => changeView('create-name');
    const handleStartSignIn = () => changeView('signin');

    const handleGenerate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim()) {
            setError(t('settings.nameRequired', { defaultValue: 'Please enter your name to continue' }));
            return;
        }
        const m = AuthService.generateMnemonic();
        setNewMnemonic(m);
        setMnemonic(m);
        setView('savekey');
    };

    const copyToClipboard = () => {
        if (newMnemonic) navigator.clipboard.writeText(newMnemonic);
    };

    const downloadKey = () => {
        if (newMnemonic) {
            const element = document.createElement("a");
            const file = new Blob([newMnemonic], {type: 'text/plain'});
            element.href = URL.createObjectURL(file);
            element.download = "pstream-recovery-phrase.txt";
            document.body.appendChild(element);
            element.click();
        }
    };

    const saveToPasskey = () => {
        if (formRef.current) {
             formRef.current.dispatchEvent(new Event('submit'));
             alert("Safe! Your phrase has been added to your browser's secure vault.");
        }
    };

    return (
        <div className="relative min-h-screen bg-black flex flex-col font-['Consolas'] overflow-hidden selection:bg-red-600/30">
            {/* Cinematic Background */}
            <div className="absolute inset-0 z-0">
                <img src={landingBg} className="w-full h-full object-cover opacity-60 scale-105" alt="background" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute inset-0 bg-black/30" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_80%)] opacity-60" />
            </div>

            <header className="relative z-[90] px-6 md:px-14 lg:px-16 pt-[calc(1rem+env(safe-area-inset-top))] pb-4">
                <div className="flex items-center justify-between">
                    <img 
                        src={logo} 
                        alt="Pstream" 
                        onClick={() => navigate('/')}
                        className="h-4 sm:h-5 md:h-6 lg:h-7 cursor-pointer drop-shadow-md transition-transform hover:scale-105" 
                    />
                </div>
            </header>

            {/* Hidden credential form — only submitted during sign-up via ref.dispatchEvent.
                Username must be set from displayName so the browser saves the right name.
                We do NOT dispatch/submit this on sign-in so the browser never prompts to save. */}
            <form ref={formRef} className="hidden" method="POST" action="/#login-success" autoComplete="on">
                <input type="text" name="username" value={displayName || ''} readOnly autoComplete="username" />
                <input type="password" name="password" value={mnemonic} readOnly autoComplete="new-password" />
                <button type="submit">Save</button>
            </form>

            <main className="relative z-10 flex-grow flex items-center justify-center px-6 py-12 md:py-20 lg:py-24">
                {view === 'landing' && (
                    <div className="max-w-4xl w-full text-center space-y-8 md:space-y-12 animate-fadeIn">
                        <div className="space-y-4">
                            <h1 className="text-3xl sm:text-4xl md:text-7xl font-black text-white leading-tight tracking-tight drop-shadow-2xl">
                                {t('auth.landingTitle', { defaultValue: 'Unlimited films, series and more' })}
                            </h1>
                            <p className="text-lg md:text-2xl text-white font-medium max-w-2xl mx-auto">
                                {t('auth.readyToWatch', { defaultValue: 'Ready to watch? Create an account or sign in to restore your collection.' })}
                            </p>
                        </div>

                        <div className="flex flex-col items-center gap-4 pt-4 md:pt-8">
                            <button
                                onClick={handleStartCreation}
                                className="w-full md:w-[460px] h-14 md:h-20 bg-[#e50914] text-white text-xl md:text-3xl font-bold rounded flex items-center justify-center gap-3 hover:bg-[#f40612] transition-all shadow-2xl hover:scale-[1.02] active:scale-95 group"
                            >
                                {t('auth.getStarted', { defaultValue: 'Get Started' })}
                                <CaretRightIcon size={28} weight="bold" className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            
                            <button
                                onClick={() => changeView('signin')}
                                className="w-full md:w-[460px] h-12 text-white/60 hover:text-white text-base md:text-lg font-bold transition-colors uppercase tracking-widest"
                            >
                                {t('auth.alreadyHaveKey', { defaultValue: 'Already have a recovery key?' })}
                            </button>
                        </div>
                    </div>
                )}

                {view === 'create-name' && (
                    <div className="max-w-[450px] w-full bg-black/75 p-8 md:p-16 rounded border border-white/10 backdrop-blur-md shadow-2xl animate-fadeIn">
                        <div className="mb-8">
                            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">
                                {t('auth.createTitle', { defaultValue: 'Create Account' })}
                            </h1>
                            <p className="text-white/50 text-sm">
                                {t('auth.createSubtitle', { defaultValue: 'Enter your name to generate your unique Pstream recovery key.' })}
                            </p>
                        </div>

                        <form onSubmit={handleGenerate} className="space-y-6">
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder={t('settings.profileName', { defaultValue: 'Profile name' })}
                                    className="w-full h-14 bg-[#333] border-b-2 border-transparent text-white rounded px-4 py-4 text-base focus:outline-none focus:bg-[#444] focus:border-red-600 transition-all placeholder:text-white/30"
                                />
                                {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
                            </div>

                            <button
                                type="submit"
                                className="w-full py-4 bg-red-600 text-white rounded font-bold uppercase tracking-widest text-sm hover:bg-red-700 transition-all active:scale-[0.98]"
                            >
                                {t('common.continue', { defaultValue: 'Continue' })}
                            </button>

                            <div className="pt-4 text-center">
                                <button type="button" onClick={() => changeView('landing')} className="text-white/40 hover:text-white text-xs underline">
                                    {t('common.back', { defaultValue: 'Back' })}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {view === 'signin' && (
                    <div className="max-w-[450px] w-full bg-black/75 p-8 md:p-16 rounded border border-white/5 backdrop-blur-md shadow-2xl animate-fadeIn">
                        <div className="mb-8">
                            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 tracking-tight">{t('auth.signIn')}</h1>
                            <p className="text-white/40 text-sm">
                                {t('auth.signInSubtitle', { defaultValue: 'Enter your 12-word recovery phrase to restore your account.' })}
                            </p>
                        </div>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-4">
                                <div className="relative group">
                                    {/* Hidden username field for password managers to contextually recognize the sign in */}
                                    <input type="text" name="username" value={displayName} onChange={() => {}} autoComplete="username" style={{display: 'none'}} />
                                    <textarea
                                        name="password"
                                        id="password"
                                        value={mnemonic}
                                        onChange={(e) => setMnemonic(e.target.value)}
                                        className="w-full h-32 bg-[#333] border-b-2 border-transparent text-white rounded px-4 py-4 text-sm focus:outline-none focus:bg-[#444] focus:border-red-600 transition-all resize-none placeholder:text-white/30"
                                        placeholder={t('auth.mnemonicPlaceholderLarge')}
                                        autoComplete="current-password"
                                    />
                                    <div onClick={() => setShowInfo(!showInfo)} className="absolute right-3 bottom-3 text-white/20 hover:text-white/60 cursor-pointer">
                                        <InfoIcon size={18} />
                                    </div>
                                </div>
                                {showInfo && (
                                    <div className="bg-white/5 border border-white/10 rounded p-3 text-[11px] text-white/50 leading-relaxed animate-slideUp">
                                        {t('auth.infoText')}
                                    </div>
                                )}
                            </div>

                            {error && <div className="text-red-500 text-xs">{error}</div>}

                            <button
                                type="submit"
                                disabled={syncStatus === 'syncing'}
                                className="w-full py-4 bg-red-600 text-white rounded font-bold uppercase tracking-widest text-sm hover:bg-red-700 transition-all active:scale-[0.98]"
                            >
                                {syncStatus === 'syncing' ? t('auth.syncing') : t('auth.signIn', { defaultValue: 'Sign In' })}
                            </button>

                            <div className="pt-4 text-center">
                                <button 
                                    type="button"
                                    onClick={() => changeView('landing')}
                                    className="text-white/40 hover:text-white text-xs underline"
                                >
                                    {t('auth.backToLanding')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {view === 'savekey' && (
                    <div className="max-w-[450px] w-full bg-black/80 p-10 md:p-12 rounded border border-white/10 backdrop-blur-md shadow-2xl animate-slideUp">
                        <div className="space-y-6">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500">
                                    <ShieldCheckIcon size={40} weight="duotone" />
                                </div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{t('auth.identityReady')}</h2>
                                <p className="text-white/50 text-sm">{t('auth.identityDesc')}</p>
                            </div>

                            <div className="p-4 bg-white/5 border border-white/10 rounded grid grid-cols-3 gap-2">
                                {newMnemonic?.split(' ').map((word, i) => (
                                    <div key={i} className="text-[10px] text-white/40 bg-black/30 p-1 rounded border border-white/5 text-center">
                                        <span className="opacity-20 mr-1">{i+1}</span> {word}
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <button
                                    onClick={() => handleLogin()}
                                    className="w-full h-14 bg-red-600 text-white rounded font-bold uppercase tracking-widest text-xs hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-600/20"
                                >
                                    {t('auth.confirmEnter')}
                                </button>
                                
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={copyToClipboard} className="h-10 border border-white/10 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                                        <CopyIcon size={16} /> {t('auth.copy')}
                                    </button>
                                    <button onClick={downloadKey} className="h-10 border border-white/10 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                                        <DownloadIcon size={16} /> {t('auth.saveFile')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            <footer className="relative z-10 py-10 px-8 text-white/30 text-[13px] text-center md:text-left md:px-32 bg-black/80">
                <p className="mb-6 opacity-60">{t('auth.footerReady')}</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl opacity-50">
                    <span className="hover:underline cursor-pointer">{t('auth.footerHelp')}</span>
                    <span className="hover:underline cursor-pointer">{t('auth.footerTerms')}</span>
                    <span className="hover:underline cursor-pointer">{t('auth.footerPrivacy')}</span>
                    <span className="hover:underline cursor-pointer">{t('auth.footerCookies')}</span>
                </div>
            </footer>
        </div>
    );
};

export default LoginPage;
