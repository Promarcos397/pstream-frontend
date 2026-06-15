const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'hooks', 'genreManifestBuilder.ts');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add sanitizeTmdbQuery function
const sanitizeFunc = `
export const sanitizeTmdbQuery = (extra: string, mediaType: 'movie' | 'tv'): string => {
  if (!extra) return extra;

  let sanitized = extra;

  // 1. Fix double with_keywords by joining them with a comma (AND) or pipe (OR)
  // Actually, TMDB API accepts comma-separated list.
  // The user wrote multiple &with_keywords=A&with_keywords=B which causes API error.
  const keywordsMatch = [...sanitized.matchAll(/&with_keywords=([0-9|]+)/g)];
  if (keywordsMatch.length > 1) {
    const combined = keywordsMatch.map(m => m[1]).join(',');
    sanitized = sanitized.replace(/&with_keywords=[0-9|]+/g, '');
    sanitized += \`&with_keywords=\${combined}\`;
  }

  // 2. Fix mediaType genre incompatibilities
  // The user merged TV and Movie rows, causing TV pages to request Movie genres (and vice versa).
  // We'll strip invalid genre requests or remap them to the closest equivalent.
  const genreMatch = sanitized.match(/&with_genres=([0-9|]+)/);
  if (genreMatch) {
    let genres = genreMatch[1].split('|');
    
    if (mediaType === 'tv') {
      genres = genres.map(g => {
        if (g === '28') return '10759'; // Action -> Action & Adventure
        if (g === '12') return '10759'; // Adventure -> Action & Adventure
        if (g === '878') return '10765'; // Sci-Fi -> Sci-Fi & Fantasy
        if (g === '14') return '10765'; // Fantasy -> Sci-Fi & Fantasy
        if (g === '10752') return '10768'; // War -> War & Politics
        if (g === '27') return '9648'; // Horror -> Mystery (closest TV match)
        if (g === '53') return '18'; // Thriller -> Drama
        if (g === '10749') return '18'; // Romance -> Drama
        if (g === '36') return '18'; // History -> Drama
        if (g === '10402') return ''; // Music has no direct TV genre, drop it or map to reality/talk? We drop it.
        return g;
      }).filter(Boolean);
    } else {
      genres = genres.map(g => {
        if (g === '10759') return '28|12'; // Action & Adventure -> Action/Adventure
        if (g === '10765') return '878|14'; // Sci-Fi & Fantasy -> Sci-Fi/Fantasy
        if (g === '10768') return '10752|36'; // War & Politics -> War/History
        if (['10762', '10763', '10764', '10766', '10767'].includes(g)) return ''; // Kids/News/Reality/Soap/Talk -> Remove
        return g;
      }).filter(Boolean);
    }

    sanitized = sanitized.replace(/&with_genres=[0-9|]+/g, '');
    if (genres.length > 0) {
      sanitized += \`&with_genres=\${genres.join('|')}\`;
    }
  }

  return sanitized;
};
`;

if (!content.includes('sanitizeTmdbQuery')) {
  // Insert before makeUrlSig
  content = content.replace('export const makeUrlSig', sanitizeFunc + '\nexport const makeUrlSig');
}

// 2. Modify gRow in buildGenreManifestSlice
const gRowPattern = /const gRow = \(key: string, title: string, sort: string, extra = ''\): SmartRow \| null => {\s*const url = REQUESTS\.fetchByGenre\(mediaType, selectedGenreId, sort, extra\);/m;
const gRowReplacement = `const gRow = (key: string, title: string, sort: string, extra = ''): SmartRow | null => {
      extra = sanitizeTmdbQuery(extra, mediaType);
      const url = REQUESTS.fetchByGenre(mediaType, selectedGenreId, sort, extra);`;

content = content.replace(gRowPattern, gRowReplacement);

fs.writeFileSync(file, content, 'utf-8');
console.log('Successfully patched genreManifestBuilder.ts with sanitizeTmdbQuery');
