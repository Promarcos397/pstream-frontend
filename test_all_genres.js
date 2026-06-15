import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tsCode = fs.readFileSync(path.join(__dirname, 'hooks', 'genreManifestBuilder.ts'), 'utf-8');

const apiKey = 'fc5fec3b73d8605daaeb1eb3b91157eb';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const rowsRegex = /\{\s*key:\s*'([^']+)',\s*title:\s*'([^']+)',\s*sort:\s*'([^']+)',\s*extra:\s*'([^']*)'\s*\}/g;
let rowMatch;
const queue = [];

while ((rowMatch = rowsRegex.exec(tsCode)) !== null) {
  const key = rowMatch[1];
  const title = rowMatch[2];
  const sort = rowMatch[3];
  const extra = rowMatch[4];
  
  // Test for movies
  queue.push({ key, title, sort, extra, mediaType: 'movie' });
  // Test for tv
  queue.push({ key, title, sort, extra, mediaType: 'tv' });
}

console.log(`Found ${queue.length} combinations to test...`);

async function testRow(row) {
  const url = `${TMDB_BASE_URL}/discover/${row.mediaType}?api_key=${apiKey}&sort_by=${row.sort}${row.extra}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.results && data.results.length === 0) {
      console.log(`\x1b[31m[ZERO RESULTS]\x1b[0m [${row.mediaType.toUpperCase()}] ${row.title} (${row.key}) => ${row.extra}`);
      return { row, success: false };
    } else if (!data.results) {
      console.log(`\x1b[31m[ERROR]\x1b[0m [${row.mediaType.toUpperCase()}] ${row.title} (${row.key}) => API error: ${JSON.stringify(data)}`);
      return { row, success: false };
    }
    return { row, success: true };
  } catch (err) {
    console.log(`\x1b[31m[FAILED]\x1b[0m [${row.mediaType.toUpperCase()}] ${row.title} (${row.key}) => ${err.message}`);
    return { row, success: false };
  }
}

async function runTests() {
  const BATCH_SIZE = 30; // increase batch size slightly for speed
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < queue.length; i += BATCH_SIZE) {
    const batch = queue.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(r => testRow(r)));
    results.forEach(res => {
      if (res.success) successCount++;
      else failCount++;
    });
  }
  
  console.log(`\nTests completed.`);
  console.log(`\x1b[32mSuccessful queries: ${successCount}\x1b[0m`);
  console.log(`\x1b[31mZero Results / Failed queries: ${failCount}\x1b[0m`);
}

runTests();
