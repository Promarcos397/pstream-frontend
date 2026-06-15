import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsCode = fs.readFileSync(path.join(__dirname, 'hooks', 'genreManifestBuilder.ts'), 'utf-8');

const apiKey = 'fc5fec3b73d8605daaeb1eb3b91157eb';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Extract the cases block
const casesRegex = /case '100\d{2}':[\s\S]*?(?=case '10\d{3}'|default:)/g;
let match;
const fetchPromises = [];

const queue = [];

while ((match = casesRegex.exec(tsCode)) !== null) {
  const caseBlock = match[0];
  const rowsRegex = /\{\s*key:\s*'([^']+)',\s*title:\s*'([^']+)',\s*sort:\s*'([^']+)',\s*extra:\s*'([^']*)'\s*\}/g;
  let rowMatch;
  while ((rowMatch = rowsRegex.exec(caseBlock)) !== null) {
    const key = rowMatch[1];
    const title = rowMatch[2];
    const sort = rowMatch[3];
    const extra = rowMatch[4];
    
    // We will test 'movie' first.
    // The previous implementation used to have movie/tv branching but now the user just returns a flat array.
    // In buildGenreManifestSlice, if mediaType is 'movie', it prefixes '/discover/movie'.
    
    queue.push({ key, title, sort, extra, mediaType: 'movie' });
  }
}

console.log(`Found ${queue.length} rows to test...`);

async function testRow(row) {
  const url = `${TMDB_BASE_URL}/discover/${row.mediaType}?api_key=${apiKey}&sort_by=${row.sort}${row.extra}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length === 0) {
      console.log(`\x1b[31m[ZERO RESULTS]\x1b[0m ${row.title} (${row.key}) => ${row.extra}`);
      return false;
    } else if (!data.results) {
      console.log(`\x1b[31m[ERROR]\x1b[0m ${row.title} (${row.key}) => API returned error:`, data);
      return false;
    }
    return true;
  } catch (err) {
    console.log(`\x1b[31m[FAILED]\x1b[0m ${row.title} (${row.key}) => ${err.message}`);
    return false;
  }
}

async function runTests() {
  const BATCH_SIZE = 20;
  let successCount = 0;
  let failCount = 0;
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(r => testRow(r)));
    results.forEach(res => { if (res) successCount++; else failCount++; });
  }
  console.log(`\nTests completed. Successful rows: ${successCount}, Failed/Zero Results rows: ${failCount}`);
}

runTests();
