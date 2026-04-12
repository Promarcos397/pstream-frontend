import * as bip39 from 'bip39';
import nacl from 'tweetnacl';
import axios from 'axios';
import { Buffer } from 'buffer';

// Ensure Buffer is available globally for bip39
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

const metaEnv = (import.meta as any).env;
// Always use the configured backend URL. Never fall back to window.location.origin 
// as that would route auth calls to the Cloudflare Pages CDN instead of the backend.
const API_BASE = metaEnv?.VITE_GIGA_BACKEND_URL || 'https://ibrahimar397-pstream-giga.hf.space';

export interface UserProfile {
  public_key: string;
  display_name?: string;
  settings: any;
  history: any[];
  list: any[];
  videoStates?: any;
  episodeProgress?: any;
  likedMovies?: any;
}

export class AuthService {
  private static TOKEN_KEY = 'pstream_session_token';

  /**
   * Generates a new 12-word mnemonic
   */
  static generateMnemonic(): string {
    return bip39.generateMnemonic();
  }

  /**
   * Derives a keypair from a 12-word mnemonic
   */
  private static async deriveKeypair(mnemonic: string) {
    const seed = await bip39.mnemonicToSeed(mnemonic);
    // Use the first 32 bytes of the seed for Ed25519
    const uint8Seed = new Uint8Array(seed.slice(0, 32));
    return nacl.sign.keyPair.fromSeed(uint8Seed);
  }

  /**
   * Performs the Login Handshake
   */
  static async login(mnemonic: string, displayName?: string, isSignUp?: boolean): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
    try {
      const keypair = await this.deriveKeypair(mnemonic);
      const publicKey = Buffer.from(keypair.publicKey).toString('base64');

      // 1. Get Challenge
      const challengeRes = await axios.get(`${API_BASE}/api/auth/challenge`, {
        params: { publicKey }
      });
      const { challenge } = challengeRes.data;

      // 2. Sign Challenge
      const signature = nacl.sign.detached(
        Buffer.from(challenge),
        keypair.secretKey
      );
      const signatureBase64 = Buffer.from(signature).toString('base64');

      // 3. Verify Challenge & Login
      const verifyRes = await axios.post(`${API_BASE}/api/auth/verify`, {
        publicKey,
        signature: signatureBase64,
        challenge,
        displayName,
        isSignUp
      });

      if (verifyRes.data.success) {
        localStorage.setItem(this.TOKEN_KEY, verifyRes.data.token);
        return { success: true, profile: verifyRes.data.profile };
      }

      return { success: false, error: 'Login failed' };
    } catch (e: any) {
      console.error('[AuthService] Login error:', e);
      return { success: false, error: e.response?.data?.error || e.message };
    }
  }

  static logout() {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  static getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  static async getProfile(): Promise<UserProfile | null> {
    const token = this.getToken();
    if (!token) return null;

    try {
      const res = await axios.get(`${API_BASE}/api/sync`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return res.data;
    } catch (e) {
      return null;
    }
  }

  static async syncProfile(updates: Partial<UserProfile>) {
    const token = this.getToken();
    if (!token) return;

    try {
      await axios.post(`${API_BASE}/api/sync`, { updates }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e: any) {
      console.error('[AuthService] Sync error details:', e.response?.data || e.message);
    }
  }

  static async deleteProfile(): Promise<boolean> {
    const token = this.getToken();
    if (!token) return false;

    try {
      const res = await axios.delete(`${API_BASE}/api/sync`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        this.logout();
        return true;
      }
      return false;
    } catch (e) {
      console.error('[AuthService] Delete error:', e);
      return false;
    }
  }
}
