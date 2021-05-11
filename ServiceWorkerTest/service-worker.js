// In Chrome, you can view these log messages and many more useful pieces of
// debugging info at chrome://inspect/#service-workers

// If at any point you want to force pages that use this service worker to start using a fresh
// cache, then increment the CACHE_VERSION value. It will kick off the service worker update
// flow and the old cache(s) will be purged as part of the activate event handler when the
// updated service worker is activated.
var CACHE_VERSION = 1;
var PRECACHE = {
  'read-through': 'read-through-cache-v' + CACHE_VERSION
};

// A list of local resources we always want to be cached.
const PRECACHE_URLS = [
  './styles/main.css'
];

// The install handler takes care of precaching the resources we always need.
self.addEventListener('install', event => {
  console.log('Install event:', event);
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(
        // Skip the 'waiting' lifecycle phase, to go directly from 'installed' to 'activated', even if
        // there are still previous incarnations of this service worker registration active.
        () => self.skipWaiting())
  );
});
  
// The activate handler takes care of cleaning up old caches.
self.addEventListener('activate',  event => {
  console.log('Activate event:', event);
  // Delete all caches that aren't named in CURRENT_CACHES.
  // While there is only one cache in this example, the same logic will handle the case where
  // there are multiple versioned caches.
  var expectedCacheNames = Object.keys(PRECACHE).map(function(key) {
    return PRECACHE[key];
  });

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (expectedCacheNames.indexOf(cacheName) === -1) {
            // If this cache name isn't present in the array of "expected" cache names, then delete it.
            console.log('Deleting out of date cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(
      // Claim any clients immediately, so that the page will be under SW control without reloading.
      () => self.clients.claim())
  );
});
  
// The fetch handler serves responses for same-origin resources from a cache.
// If no response is found, it populates the runtime cache with the response
// from the network before returning it to the page.
self.addEventListener('fetch', function(event) {
  console.log('Handling fetch event for', event.request.url);

  event.respondWith(
    caches.open(PRECACHE['read-through']).then(function(cache) {
        return cache.match(event.request).then(function(response) {
            if (response) {
          // If there is an entry in the cache for event.request, then response will be defined
          // and we can just return it.
          console.log(' Found response in cache:', response);
    
          return response;
        }
  
        // Otherwise, if there is no entry in the cache for event.request, response will be
        // undefined, and we need to fetch() the resource.
        console.log(' No response for %s found in cache. ' +
        'About to fetch from network...', event.request.url);
  
        // We call .clone() on the request since we might use it in the call to cache.put() later on.
        // Both fetch() and cache.put() "consume" the request, so we need to make a copy.
        // (see https://fetch.spec.whatwg.org/#dom-request-clone)
        return fetch(event.request.clone()).then(function(response) {
            console.log('  Response for %s from network is: %O',
            event.request.url, response);
          // Return the original response object, which will be used to fulfill the resource request.
          return response;
        });
      }).catch(function(error) {
        // This catch() will handle exceptions that arise from the match() or fetch() operations.
        // Note that a HTTP error response (e.g. 404) will NOT trigger an exception.
        // It will return a normal response object that has the appropriate error code set.
        console.error('  Read-through caching failed:', error);
  
        throw error;
      });
    })
  );
});