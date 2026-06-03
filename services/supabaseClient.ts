import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Mock Supabase auth and database methods if running in Playwright test environment
if (typeof window !== 'undefined' && (window as any).__PLAYWRIGHT_TEST__) {
  const mockUser = {
    id: 'mock-user-id',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'test@pstream.com',
    user_metadata: {
      display_name: 'Test User',
      avatar_url: 'https://lh3.googleusercontent.com/d/198aosLkzeCyglhaKy5vPMeWktSJhFui_'
    }
  };

  const mockSession = {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    refresh_token: 'mock-refresh-token',
    user: mockUser,
    expires_at: Math.floor(Date.now() / 1000) + 3600
  };

  supabase.auth.getSession = async () => {
    return {
      data: { session: mockSession },
      error: null
    } as any;
  };

  supabase.auth.getUser = async () => {
    return {
      data: { user: mockUser },
      error: null
    } as any;
  };

  supabase.auth.onAuthStateChange = (callback) => {
    // Immediate callback execution to simulate successful login
    callback('SIGNED_IN', mockSession as any);
    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    } as any;
  };

  // Mock database query builder to prevent remote requests and return success responses
  const mockFrom = () => {
    const builder = {
      select: () => builder,
      insert: async () => ({ error: null }),
      update: async () => ({ error: null }),
      upsert: async () => ({ error: null }),
      delete: () => builder,
      eq: () => builder,
      single: async () => ({ data: null, error: { code: 'PGRST116' } }), // PGRST116 tells useAuthStore to insert default settings
      then: (resolve: any) => {
        resolve({ data: [], error: null });
        return Promise.resolve({ data: [], error: null });
      }
    };
    return builder;
  };

  supabase.from = mockFrom as any;
}
