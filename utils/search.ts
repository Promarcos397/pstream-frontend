/**
 * Dispatches a global search event that App.tsx listens to.
 * This avoids prop-drilling `setQuery` through the entire component tree.
 *
 * Usage:
 *   import { triggerSearch } from '../utils/search';
 *   triggerSearch(navigate, 'Timothée Chalamet');
 */
export function triggerSearch(navigate: (path: string) => void, query: string) {
    if (!query?.trim()) return;
    const finalQuery = query.trim();
    // Dispatch event for instant UI update
    window.dispatchEvent(
        new CustomEvent('pstream:search', { detail: { query: finalQuery } })
    );
    // Navigate with the query in the URL for shareability and persistence
    navigate(`/?q=${encodeURIComponent(finalQuery)}`);
}
