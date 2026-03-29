const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'locales');
const newGenres = {
  "9648": "Mystery",
  "10759": "Action & Adventure",
  "10765": "Sci-Fi & Fantasy"
};

const newRows = {
  classic90s: "Classic 90s {{genre}}",
  biteSized: "Bite-Sized {{genre}}",
  blockbusters: "Blockbuster {{genre}}",
  genreMix: "{{genre1}} & {{genre2}}",
  offbeatSeries: "Offbeat Series",
  kDramaBeginners: "K-Drama for Beginners",
  witFilledComedies: "Wit-Filled Comedies",
  grittyCrime: "Gritty Crime Procedurals",
  heartPoundingAction: "Heart-Pounding Action",
  smallTownMysteries: "Small Town Mysteries",
  thoughtProvokingSciFi: "Thought-Provoking Sci-Fi",
  theVault90s: "The Vault: 90s Classics",
  essentialClassics: "Essential Classics",
  nostalgic2000s: "Nostalgic 2000s Hits",
  edgeOfYourSeat: "Edge-of-Your-Seat Thrills",
  biteSizedStories: "Bite-Sized Stories",
  epicSagas: "Epic Sagas & Legacies",
  storiesSparkConversation: "Stories That Spark Conversation",
  unmissableGems: "Unmissable Hidden Gems",
  internationalBreakouts: "International Breakout Hits",
  indieFavorites: "Indie Favorites",
  sundayWindDown: "Sunday Night Wind-Down",
  fridayNightHits: "Friday Night Hits",
  lateNightChill: "Late Night Chill",
  visuallyStunning: "Visually Stunning Worlds",
  highStakesHeists: "High-Stakes Heists",
  cyberpunkDystopia: "Cyberpunk & Dystopia",
  politicalMindGames: "Political Mind Games",
  supernaturalEncounters: "Supernatural Encounters",
  mindBendingRealities: "Mind-Bending Realities",
  trueStoriesDocuseries: "True Stories & Docuseries",
  basedOnRealLife: "Based on Real Life"
};

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

for (const file of files) {
  const filePath = path.join(localesDir, file);
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Add missing keys to data.genres
    if (!data.genres) data.genres = {};
    for (const [key, value] of Object.entries(newGenres)) {
      if (!data.genres[key]) {
        data.genres[key] = value;
      }
    }

    // Add missing keys to data.rows
    if (!data.rows) data.rows = {};
    for (const [key, value] of Object.entries(newRows)) {
      if (!data.rows[key]) {
        data.rows[key] = value;
      }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
    console.log(`Updated ${file}`);
  } catch (error) {
    console.error(`Error processing ${file}:`, error);
  }
}
