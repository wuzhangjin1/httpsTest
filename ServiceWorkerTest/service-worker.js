// In Chrome, you can view these log messages and many more useful pieces of
// debugging info at chrome://inspect/#service-workers

// If at any point you want to force pages that use this service worker to start using a fresh
// cache, then increment the CACHE_VERSION value. It will kick off the service worker update
// flow and the old cache(s) will be purged as part of the activate event handler when the
// updated service worker is activated.
var CACHE_VERSION = 1;
var CURRENT_CACHES  = {
  'prefetch': 'read-through-cache-v' + CACHE_VERSION
};

// The install handler takes care of precaching the resources we always need.
self.addEventListener('install', event => {
  var now = Date.now();

  var urlsToPrefetch = [
    'styles/main.css'
  ];

  console.log('Handling install event. Resources to prefetch:', urlsToPrefetch);

  event.waitUntil(
    caches.open(CURRENT_CACHES.prefetch)
      .then(cache => cache.addAll(urlsToPrefetch))
      .then(self.skipWaiting())
  );
});
  
// The activate handler takes care of cleaning up old caches.
self.addEventListener('activate',  event => {
  console.log('Activate event:', event);
  // Delete all caches that aren't named in CURRENT_CACHES.
  // While there is only one cache in this example, the same logic will handle the case where
  // there are multiple versioned caches.
  var expectedCacheNames = Object.keys(CURRENT_CACHES).map(function(key) {
    return CURRENT_CACHES[key];
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
    }).then(self.clients.claim())
  );
});
  
// The fetch handler serves responses for same-origin resources from a cache.
// If no response is found, it populates the runtime cache with the response
// from the network before returning it to the page.
self.addEventListener('fetch', function(event) {
  console.log('Handling fetch event for', event.request.url);

  event.respondWith(
    caches.open(CURRENT_CACHES['read-through']).then(function(cache) {
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
  
        return fetch(event.request).then(function(response) {
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