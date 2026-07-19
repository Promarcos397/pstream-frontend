/**
 * Signup email validation.
 *
 * Supabase throttles projects with high bounce rates because transactional
 * mail goes out over their shared pool. Bounces come from two places:
 * addresses that never existed (typos, throwaway junk) and bot signups.
 *
 * This module handles the first kind — it runs before supabase.auth.signUp so
 * a bad address never becomes a send. It does nothing about bots, which post
 * straight to the API and never load this code; that needs CAPTCHA enabled in
 * the Supabase dashboard (Authentication -> Bot and Abuse Protection).
 *
 * Deliberately conservative: a rejected real user is worse than an accepted
 * bounce, so anything ambiguous is allowed through.
 */

/** Practical address shape. Not RFC 5322 — that accepts things no MTA wants. */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * Throwaway inbox providers. These accept mail briefly then evaporate, so
 * confirmation links die and the address later bounces.
 */
const DISPOSABLE_DOMAINS = new Set([
    'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', '10minutemail.com',
    'tempmail.com', 'temp-mail.org', 'throwawaymail.com', 'yopmail.com',
    'trashmail.com', 'sharklasers.com', 'getnada.com', 'dispostable.com',
    'maildrop.cc', 'fakeinbox.com', 'mailnesia.com', 'mytemp.email',
    'tempinbox.com', 'spamgourmet.com', 'mohmal.com', 'emailondeck.com',
    'burnermail.io', 'moakt.com', 'tempmailo.com', 'luxusmail.org',
]);

/** Obvious placeholders people type when they don't want to give an address. */
const PLACEHOLDER_LOCALS = new Set([
    'test', 'asdf', 'asd', 'aaa', 'abc', 'qwerty', 'admin', 'noreply',
    'no-reply', 'example', 'foo', 'bar', 'user', 'none', 'null', 'undefined',
]);

/** Typos of common providers -> the domain the user meant. */
const DOMAIN_TYPOS: Record<string, string> = {
    'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com',
    'gmail.cm': 'gmail.com', 'gmaill.com': 'gmail.com', 'gnail.com': 'gmail.com',
    'gmail.con': 'gmail.com', 'gamil.com': 'gmail.com', 'gmail.om': 'gmail.com',
    'hotmial.com': 'hotmail.com', 'hotmai.com': 'hotmail.com', 'hotmail.co': 'hotmail.com',
    'hotmail.con': 'hotmail.com', 'hotmial.co': 'hotmail.com',
    'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
    'yahoo.con': 'yahoo.com', 'yahoo.om': 'yahoo.com',
    'outlok.com': 'outlook.com', 'outloo.com': 'outlook.com', 'outlook.co': 'outlook.com',
    'iclod.com': 'icloud.com', 'icloud.co': 'icloud.com', 'iclould.com': 'icloud.com',
    'protonmai.com': 'protonmail.com', 'protonmail.co': 'protonmail.com',
};

export interface EmailCheck {
    valid: boolean;
    /** Why it was rejected — safe to show the user. */
    reason?: string;
    /** Set when the address looks like a typo; offer this as a correction. */
    suggestion?: string;
}

export function validateSignupEmail(raw: string): EmailCheck {
    const email = (raw || '').trim().toLowerCase();

    if (!email) return { valid: false, reason: 'Please enter your email address.' };
    if (email.length > 254) return { valid: false, reason: 'That email address is too long.' };
    if (!EMAIL_RE.test(email)) {
        return { valid: false, reason: 'That doesn\'t look like a valid email address.' };
    }

    const [local, domain] = email.split('@');

    // Consecutive dots and leading/trailing dots are rejected by most MTAs.
    if (local.startsWith('.') || local.endsWith('.') || email.includes('..')) {
        return { valid: false, reason: 'That doesn\'t look like a valid email address.' };
    }

    // A typo is the single most likely cause of a real person bouncing, so
    // suggest the fix rather than a bare rejection.
    const corrected = DOMAIN_TYPOS[domain];
    if (corrected) {
        return {
            valid: false,
            reason: `Did you mean ${local}@${corrected}?`,
            suggestion: `${local}@${corrected}`,
        };
    }

    if (DISPOSABLE_DOMAINS.has(domain)) {
        return { valid: false, reason: 'Please use a permanent email address so you can recover your account.' };
    }

    // Only reject placeholders on throwaway-looking domains — "test@" at a real
    // company domain is a plausible address.
    if (PLACEHOLDER_LOCALS.has(local) && /^(test|example|asdf|abc|aaa)\./.test(domain)) {
        return { valid: false, reason: 'Please enter a real email address.' };
    }

    if (domain === 'example.com' || domain === 'test.com' || domain.endsWith('.test') || domain.endsWith('.invalid')) {
        return { valid: false, reason: 'Please enter a real email address.' };
    }

    return { valid: true };
}
