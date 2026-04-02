/**
 * P-Stream Giga Edge Service Worker v1.0.0
 * 
 * This service worker intercepts media requests from the browser to:
 * 1. Inject spoofed Referer/Origin headers that bypassed our backend 403 blocks.
 * 2. Rewrite response headers locally to bypass CORS without a middleman server.
 * 3. Use the user's RESIDENTIAL native IP address (bypassing Datacenter WAFs).
 */

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

const STREAM_DOMAINS = [
    'vodvidl.site', 
    'thunderleaf', 
    'frostcomet', 
    'cloudnestra', 
    'vsembed.ru',
    'neonhorizonworkshops.com',
    'wanderlynest.com',
    'orchidpixelgardens.com',
    'pstream-cdn.com'
];

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only intercept and fix requests for known streaming provider domains
    if (STREAM_DOMAINS.some(domain => url.hostname.includes(domain))) {
        event.respondWith(
            (async () => {
                try {
                    // Create headers and inject the required spoofing values
                    const newHeaders = new Headers(event.request.headers);
                    newHeaders.set('Referer', 'https://videostr.net/');
                    newHeaders.set('Origin', 'https://videostr.net');
                    
                    // Kill the 'Sec-Fetch' headers that trigger strict CORS preflights in Chrome
                    newHeaders.delete('Sec-Fetch-Site');
                    newHeaders.delete('Sec-Fetch-Mode');
                    newHeaders.delete('Sec-Fetch-Dest');

                    const modifiedRequest = new Request(event.request.url, {
                        method: event.request.method,
                        headers: newHeaders,
                        mode: 'cors',
                        credentials: 'omit',
                        redirect: 'follow'
                    });

                    const response = await fetch(modifiedRequest);

                    // If the response is OK, we need to inject permissive CORS headers locally 
                    // This is the "Local Proxy" breakthrough
                    const responseHeaders = new Headers(response.headers);
                    responseHeaders.set('Access-Control-Allow-Origin', '*');
                    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
                    responseHeaders.set('Access-Control-Expose-Headers', '*');
                    
                    // Ensure the browser doesn't block the content type
                    const body = await response.blob(); 
                    
                    return new Response(body, {
                        status: response.status,
                        statusText: response.statusText,
                        headers: responseHeaders
                    });
                } catch (error) {
                    // If anything fails, let the browser handle it natively
                    return fetch(event.request);
                }
            })()
        );
    }
});
