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
    // Dispatch the custom event so App.tsx picks it up and calls setQuery()
    window.dispatchEvent(
        new CustomEvent('pstream:search', { detail: { query: query.trim() } })
    );
    // Navigate to home so the search results overlay appears
    navigate('/');
}
