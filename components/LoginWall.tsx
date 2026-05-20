import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const LoginWall: React.FC = () => {
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
        const { error } = await supabase.auth.signUp({ email, password });
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
          <h2 className="text-3xl font-black tracking-tight">{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="text-white/50 mt-2 text-sm">You must be logged in to access the library.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              placeholder="name@example.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-red-500 transition-colors"
              placeholder="••••••••"
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
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-white/60 hover:text-white text-sm transition-colors"
          >
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};
