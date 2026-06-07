# P-Stream Developer Compatibility Log: Third-Party Embed Audits

A living log of verified third-party embed providers, their programmatic APIs, query parameters, and event-driven postMessage schemas.

---

## 🟢 1. Cinezo.live (Cooperative Provider)
* **Status**: Highly Active, Developer-First
* **Base Domain**: `https://cinezo.live`
* **Player Origin**: `https://player.cinezo.live`
* **Intrusiveness**: Low ads/clean UI (documented for external integrations).

### Outbound Event Architecture
Cinezo uses a lightweight, structured `postMessage` protocol to communicate player state, progress, and actions directly to our parent window in real time.

#### Packet Structure (`WATCH_PROGRESS`)
When playing, the Cinezo iframe broadcasts messages to the parent window containing the following structured payload:

```json
{
  "type": "WATCH_PROGRESS",
  "data": {
    "mediaId": "movie_27205",
    "eventType": "timeupdate",
    "currentTime": 1247.5,
    "duration": 7200
  }
}
```

#### Supported Event Types (`eventType` values):
1. `play` - Fired instantly when video starts or resumes playing.
2. `pause` - Fired instantly when video is paused.
3. `seeked` - Fired when the user jumps or skips to a different timestamp.
4. `ended` - Fired when the stream reaches the end.
5. `timeupdate` - Fired periodically (high frequency) to sync time.

---

### P-Stream Integration Implementation

We can capture these messages inside our `EmbedPlayer.tsx` listener to achieve **flawless, reload-free progress tracking, subtitle syncing, and mobile play/pause status toggles** with zero delay!

#### Integration Event Listener Snippet:
```javascript
window.addEventListener('message', (event) => {
    // 1. Verify trusted Cinezo player origin
    if (event.origin !== 'https://player.cinezo.live') return;
    
    // 2. Intercept structured progress events
    if (event.data?.type === 'WATCH_PROGRESS') {
        const { mediaId, eventType, currentTime, duration } = event.data.data;
        
        // 3. Keep P-Stream parent state in perfect lock-step sync
        onTimeUpdate?.(currentTime, duration);
        
        if (eventType === 'play')  onPlay?.();
        if (eventType === 'pause') onPause?.();
        if (eventType === 'ended') onEnded?.();
    }
});
```

---

## 💎 2. GoatAPI (Direct Streaming Extractor API)
* **Status**: Highly Active, Developer-Focused
* **Base URL**: `https://goatapi.imreallydagoatt.workers.dev`
* **Intrusiveness**: Zero (returns direct raw stream URLs via JSON REST endpoints).
* **Player Impact**: **God-Tier** (renders completely native HTML5 player with instant skips/seeks, 0 ads, custom subtitles, and no iframes).

### Key APIs & Endpoint Specifications

#### 1. Lightning API (Ultra-Fast 1080p Streams)
The core engine for instant play. Tests English providers sequentially and returns the first active direct stream.
* **Get Movie Stream**: 
  `GET /api/lightning/movie/{tmdb_id}?source={optional_source}`
* **Get TV Episode Stream**: 
  `GET /api/lightning/tv/{tmdb_id}/{season}/{episode}?source={optional_source}`

**Sample JSON Response Format**:
```json
{
  "success": true,
  "provider": "downloader",
  "type": "movie",
  "tmdb_id": 550,
  "title": "Fight Club",
  "year": 1999,
  "streams": [
    {
      "quality": "1080p",
      "url": "https://direct-stream-cdn.com/play/fight-club.m3u8",
      "codec": "h264"
    }
  ]
}
```

#### 2. Subtitles API (Dedicated VTT/SRT Streams)
Fetches clean, multi-language subtitle tracks directly matched to TMDB content.
* **Get Movie Subtitles**: `GET /api/subtitles/movie/{tmdb_id}`
* **Get TV Subtitles**: `GET /api/subtitles/tv/{tmdb_id}/{season}/{episode}`

#### 3. Debrid API (Premium Uncapped)
Integrates premium Real-Debrid streaming endpoints by proxying user debrid tokens.
* **Get Movie/TV Stream**: `GET /api/debrid/movie/{tmdb_id}?token={rd_key}`

---

### P-Stream Backend Extractor Integration
We can integrate this into `giga-backend/extractors/goatapi.js` to race it alongside our other extractors.

```javascript
import { gigaAxios } from '../utils/http.js';

export async function scrapeGoatAPI(tmdbId, type, season, episode) {
    try {
        const url = type === 'movie'
            ? `https://goatapi.imreallydagoatt.workers.dev/api/lightning/movie/${tmdbId}`
            : `https://goatapi.imreallydagoatt.workers.dev/api/lightning/tv/${tmdbId}/${season}/${episode}`;
            
        const response = await gigaAxios.get(url, { timeout: 10000 });
        if (response.data?.success && response.data.streams?.length > 0) {
            return {
                success: true,
                provider: 'GoatAPI 🐐',
                sources: response.data.streams.map(s => ({
                    url: s.url,
                    quality: s.quality || '1080p',
                    isM3U8: s.url.includes('.m3u8') || s.codec === 'h264',
                    isEmbed: false
                })),
                subtitles: []
            };
        }
    } catch (e) {
        console.warn(`[GoatAPI] Scrape failed: ${e.message}`);
    }
    return null;
}
```

---

## 🟢 3. StreamVault (Highly Cooperative Iframe Embed)
* **Status**: Highly Active, Developer-Focused
* **Base Domain**: `https://streamvaultsrc.click`
* **Intrusiveness**: Low/Free (no pop-ups stated, built specifically for developer embeds).
* **Player Impact**: **Excellent** (supports full programmatic incoming controls and outbound timeupdates for subtitles!).

### Iframe URL Query Parameters
StreamVault accepts parameters to customize the player's core state on launch:
* `autoplay=true` - Automatically starts stream.
* `muted=true` - Launches muted (critical to bypass autoplay browser blocks).
* `seek={seconds}` - Starts video at exact timestamp (standard P-Stream resume parameter!).
* `color=%23a855f7` - Replaces the native player accent color with a custom Hex value (matches P-Stream's premium branding!).
* `autonext=false` - Disables native TV auto-advance if we want P-Stream's custom transition UI.

---

### Inbound postMessage Control API
We can control the StreamVault iframe player programmatically **without ever reloading the embed!**

```javascript
// Grab the iframe reference
const iframe = document.querySelector('iframe');

// 1. Programmatic Play
iframe.contentWindow.postMessage({ type: 'play' }, '*');

// 2. Programmatic Pause
iframe.contentWindow.postMessage({ type: 'pause' }, '*');

// 3. Programmatic Instant Seek (RELOAD-FREE SEEMS POSSIBLE!)
iframe.contentWindow.postMessage({ type: 'seek', data: { time: 120 } }, '*');

// 4. Volume / Mute
iframe.contentWindow.postMessage({ type: 'mute' }, '*');
iframe.contentWindow.postMessage({ type: 'unmute' }, '*');
```

---

### Outbound Event Architecture
StreamVault broadcasts real-time events that we can listen to from origin `https://streamvaultsrc.click`:

* **`ready`** - Player completed loading and is ready.
* **`play`** - Stream started playing.
* **`pause`** - Stream paused.
* **`timeupdate`** - Playback progress changed (returns `data.time` in seconds).
* **`ended`** - Video reached the end.
* **`error`** - Stream loading error occurred (returns `data.message` detail).

#### P-Stream Integration Listener Snippet:
```javascript
window.addEventListener('message', (event) => {
    if (event.origin !== 'https://streamvaultsrc.click') return;
    
    const { type, data } = event.data;
    
    if (type === 'timeupdate') {
        const currentSeconds = data?.time;
        if (typeof currentSeconds === 'number') {
            onTimeUpdate?.(currentSeconds, estimatedDuration);
        }
    }
    
    if (type === 'play')  onPlay?.();
    if (type === 'pause') onPause?.();
    if (type === 'ended') onEnded?.();
});
```

---

## 🟢 4. TryEmbed & VidPlays (Cooperative Player Network)
* **Status**: Highly Active, Developer-Focused
* **Base Domains**: 
  * Anime: `https://tryembed.us.cc`
  * Movies & TV: `https://vidplays.fun` (Shares the same unified engine!)
* **Intrusiveness**: Minimal/Low (zero pop-ups stated, respectful design).
* **Player Impact**: **God-Tier** (exposes high-frequency 100ms state broadcasts and robust seek postMessage commands!).

### Unified URL Query Parameters
* `autoplay=true` - Automatically plays stream on load.
* `autoSkip=true` - Automatically bypasses intro/outro sequences natively!
* `autoNext=false` - Disables default next-episode navigation.
* `startAt={seconds}` - Starts video at exact timestamp (resume watch progress!).
* `opensubs=url|Lang,url2|Lang2` - **Amazing feature**: Allows injecting our custom `.vtt` subtitles directly into their native player via comma-separation!
* `lang-type=false` - Hides the SUB/DUB track selector overlay.

---

### Inbound postMessage Control API
We can control the TryEmbed/VidPlays player dynamically **without ever reloading the embed!**

```javascript
const iframe = document.querySelector('iframe');

// 1. Play / Pause Control
iframe.contentWindow.postMessage({ command: 'play' }, '*');
iframe.contentWindow.postMessage({ command: 'pause' }, '*');

// 2. Programmatic Instant Seek (RELOAD-FREE SEEMS POSSIBLE!)
iframe.contentWindow.postMessage({ command: 'seek', time: 150 }, '*');

// 3. Programmatic Volume Control
iframe.contentWindow.postMessage({ command: 'volume', level: 0.8 }, '*');
```

---

### Outbound Event Architecture (High-Frequency 100ms Broadcast)
TryEmbed/VidPlays uses an **aggressive 100ms telemetry broadcast** which gives us incredibly smooth progress tracking and subtitle overlays!

#### Packet Structure (`PLAYER_EVENT`)
```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "event": "timeupdate",
    "currentTime": 553.938306,
    "duration": 1372.051999999999,
    "paused": true,
    "muted": false,
    "volume": 1,
    "playbackRate": 1
  }
}
```

#### P-Stream Integration Listener Snippet:
```javascript
window.addEventListener('message', ({ data }) => {
    // Intercept unified PLAYER_EVENT signals
    if (data?.type === 'PLAYER_EVENT') {
        const payload = data.data;
        const eventType = payload.event;
        const currentSeconds = payload.currentTime;
        const duration = payload.duration;
        
        if (typeof currentSeconds === 'number') {
            onTimeUpdate?.(currentSeconds, duration);
        }
        
        if (eventType === 'play')  onPlay?.();
        if (eventType === 'pause') onPause?.();
        if (eventType === 'ended') onEnded?.();
    }
});
```

---

## 🟢 5. VidAPI & VaPlayer (Cooperative Custom UI Embed)
* **Status**: Highly Active, Premium Developer API
* **Base Domains**: 
  * API: `https://vidapi.ru`
  * Player Player Embed: `https://vaplayer.ru`
* **Intrusiveness**: Extremely low / secure CSP ancestors.
* **Player Impact**: **Exceptional** (supports a true headless state where native controls and overlays are entirely disabled, allowing our parent controls to integrate natively!).

### Highly Customisable Query Parameters
* `controls=false` - **The Holy Grail of custom players**: Completely hides the player control bar and native buttons, turning the iframe into a pure video canvas.
* `overlay=false` - Disables the native darkening hover gradient and title area. Combined with `controls=false`, the player feels like a completely integrated part of P-Stream's custom UI!
* `primaryColor={hex}` - Direct Hex code mapping to style the player UI colors (e.g. `%23a855f7` matches our signature theme).
* `resumeAt={seconds}` / `startAt={seconds}` - Starts video at exact timestamp (watch progress resume).
* `autoplay=1` - Auto-plays stream on load (forces muted fallback to bypass browser blocks).
* `sub_url={url}` - **Server-side subtitle proxying**: Allows injecting external subtitles (`.vtt` or `.srt`) directly. Crucially, **CORS is handled server-side**, meaning we can bypass browser origin restrictions on subtitles entirely!
* `sub_label`, `sub_lang`, `sub_default` - Styles the custom injected subtitle track.
* `ds_lang={lang}` - Automatically queries and loads OpenSubtitles tracks in the specified language.

---

### Outbound Event Architecture (`PLAYER_EVENT`)
VidAPI broadcasts a single, unified `PLAYER_EVENT` message that P-Stream already intercepts in `EmbedPlayer.tsx`!

#### Packet Structure:
```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "player_info": {
      "imdb": "tt23779058",
      "tmdb": 1147301,
      "mediaType": "movie",
      "season": null,
      "episode": null,
      "title": "My Movie",
      "poster": "https://..."
    },
    "player_status": "playing", // 'playing' | 'paused' | 'completed' | 'seeked'
    "player_progress": 125.4,
    "player_duration": 7200,
    "quality": { "label": "1080p", "width": 1920, "height": 1080 },
    "availableQualities": ["1080p", "720p", "480p", "360p"]
  }
}
```

#### P-Stream Integration Listener Snippet:
```javascript
window.addEventListener('message', (event) => {
    if (event.data?.type !== 'PLAYER_EVENT') return;
    
    const { player_info, player_status, player_progress, player_duration } = event.data.data;
    
    if (typeof player_progress === 'number') {
        onTimeUpdate?.(player_progress, player_duration);
    }
    
    if (player_status === 'playing')   onPlay?.();
    if (player_status === 'paused')    onPause?.();
    if (player_status === 'completed') onEnded?.();
});
```

---

## 🟡 6. VIDEASY (Tier 2 Fallback Iframe)
* **Status**: Active, Decent Developer Options
* **Base Domain**: `https://player.videasy.net`
* **Intrusiveness**: Low (no intrusive overlays documented).
* **Player Impact**: **Moderate** (does not document inbound postMessage seeks, but broadcasts solid outbound telemetry that we can parse for subtitle sync!).

### Iframe URL Query Parameters
* `progress={seconds}` - Starts video at exact timestamp (standard P-Stream resume parameter!).
* `color={hex_without_hash}` - Replaces the player accent theme color with a custom Hex value (e.g. `color=a855f7` matches our accent theme).
* `nextEpisode=true` - Displays a next-episode overlay button.
* `autoplayNextEpisode=true` - Automatically triggers TV transitions.
* `overlay=true` - Netflix-style paused overlay.

---

### Outbound Event Architecture (String-Encoded JSON)
VIDEASY broadcasts its telemetry to the parent window. Crucially, the payload is sent as a **string-encoded JSON packet**, which we must manually check and parse!

#### Packet Structure (Decoded):
```json
{
  "id": "299534",
  "type": "movie",
  "progress": 17.3,
  "timestamp": 1247.5,    // Current playback position in seconds!
  "duration": 7200,       // Total duration in seconds!
  "season": null,
  "episode": null
}
```

#### P-Stream Integration Listener Snippet:
```javascript
window.addEventListener('message', (event) => {
    let data = event.data;
    
    // VIDEASY sends string-encoded JSON; attempt to parse it safely
    if (typeof data === 'string') {
        try {
            data = JSON.parse(data);
        } catch (_) {
            return; // Not valid JSON, skip
        }
    }
    
    // Intercept VIDEASY telemetry structure
    if (data && typeof data === 'object' && data.timestamp !== undefined && data.duration !== undefined) {
        const currentSeconds = data.timestamp;
        const duration = data.duration;
        
        onTimeUpdate?.(currentSeconds, duration);
        
        // Optimistically trigger play/pause state since they don't send explicit event status flags
        onPlay?.();
    }
});
```

---

## 🟢 7. VidFast (Cooperative Master Embed)
* **Status**: Highly Active, P-Stream Primary Tier 1 Provider
* **Base Domains**: 
  `vidfast.pro`, `vidfast.in`, `vidfast.io`, `vidfast.me`, `vidfast.net`, `vidfast.pm`, `vidfast.xyz`
* **Intrusiveness**: Extremely low, developer-friendly.
* **Player Impact**: **God-Tier** (now fully unlocked with native programmatic seeking and complete custom styles!).

### Highly Customisable Query Parameters
We can clean up and style the VidFast player interface on launch using these parameters:
* `theme=9B59B6` - Renders all player UI accents, sliders, and overlays in **P-Stream purple** to match our branding!
* `hideServer=true` - Hides their native server-change overlay to keep the interface simple and unified.
* `title=false` - Disables default overlay title.
* `poster=false` - Disables default overlay poster.
* `startAt={seconds}` - Restores saved watch progress.
* `sub={lang_code}` - Sets default subtitle language (e.g. `sub=en`).
* `nextButton=true` - TV shows: shows the "Next Episode" button overlay when 90% watched.
* `autoNext=true` - TV shows: automatically plays the next episode upon completion.

---

### CRITICAL DISCOVERY: Inbound postMessage Control API
We previously shotgun-sent seek messages like `{ type: 'seek', time }` or `{ action: 'seek' }`, which were ignored by VidFast. VidFast explicitly expects a `command` attribute!

#### The Missing Commands:
```javascript
const iframe = document.querySelector('iframe');

// 1. Instant, Reload-Free Seek (THE UNLOCKED FIX!)
iframe.contentWindow.postMessage({ command: 'seek', time: 120 }, '*');

// 2. Play / Pause Controls
iframe.contentWindow.postMessage({ command: 'play' }, '*');
iframe.contentWindow.postMessage({ command: 'pause' }, '*');

// 3. Mute & Volume
iframe.contentWindow.postMessage({ command: 'mute', muted: true }, '*');
iframe.contentWindow.postMessage({ command: 'volume', level: 0.8 }, '*');
```

---

### Outbound Event Architecture (`PLAYER_EVENT` & `MEDIA_DATA`)
VidFast broadcasts telemetry every time status updates or progress changes:

```json
{
  "type": "PLAYER_EVENT",
  "data": {
    "event": "play" | "pause" | "seeked" | "ended" | "timeupdate",
    "currentTime": 120.45,
    "duration": 7200,
    "playing": true,
    "muted": false,
    "volume": 1
  }
}
```

#### P-Stream Integration Listener Snippet:
```javascript
window.addEventListener('message', ({ origin, data }) => {
    // 1. Verify message is from a trusted VidFast origin domain
    const vidfastOrigins = [
        'https://vidfast.pro', 'https://vidfast.in', 'https://vidfast.io',
        'https://vidfast.me', 'https://vidfast.net', 'https://vidfast.pm',
        'https://vidfast.xyz'
    ];
    if (!vidfastOrigins.includes(origin) || !data) return;
    
    // 2. Intercept VidFast telemetry events
    if (data.type === 'PLAYER_EVENT') {
        const { event, currentTime, duration } = data.data;
        
        onTimeUpdate?.(currentTime, duration);
        
        if (event === 'play')  onPlay?.();
        if (event === 'pause') onPause?.();
        if (event === 'ended') onEnded?.();
    }
});
```






