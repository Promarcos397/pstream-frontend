import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../services/supabaseClient';

export const LoginWall: React.FC = () => {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + '/'
          }
        });
        if (error) throw error;
        // Auto-login or show success message for email verification if required
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-white flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0 opacity-40 bg-[url('/assets/landing-bg.png')] bg-cover bg-center mix-blend-overlay" />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-black via-black/80 to-transparent" />
      
      <div className="relative z-10 bg-white/5 border border-white/10 backdrop-blur-xl p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <img src="/assets/logos/pstream-logo.svg" alt="P-Stream" className="h-8 mx-auto mb-6" />
          <h2 className="text-3xl font-black tracking-tight">{isLogin ? t('auth.welcome') : t('auth.createAccount')}</h2>
          <p className="text-white/50 mt-2 text-sm">{t('auth.loginRequired', { defaultValue: 'You must be logged in to access the library.' })}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">{t('auth.emailPlaceholder', { defaultValue: 'Email' })}</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">{t('auth.passwordPlaceholder', { defaultValue: 'Password' })}</label>
            <input 
              type="password" 
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              placeholder={t('auth.passwordPlaceholder')}
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-3 rounded-lg transition-colors mt-6"
          >
            {loading ? t('auth.redirecting') : (isLogin ? t('auth.signIn') : t('auth.createAccount'))}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            {isLogin ? `${t('auth.dontHaveAccount')} ${t('auth.signUpLink')}` : `${t('auth.alreadyHaveAccount')} ${t('auth.signInLink')}`}
          </button>
        </div>
      </div>
    </div>
  );
};
