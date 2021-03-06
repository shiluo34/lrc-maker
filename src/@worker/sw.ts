declare const self: ServiceWorkerGlobalScope;
export {};

const APP_NAME = "akari-lrc-maker";
const VERSION = Version.value;

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all<any>([
                self.clients.claim(),
                ...cacheNames
                    .filter((cacheName) => {
                        return cacheName.startsWith(APP_NAME) && cacheName !== `${APP_NAME}-${VERSION}`;
                    })
                    .map((cacheName) => {
                        return caches.delete(cacheName);
                    }),
            ]);
        }),
    );
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);

    if (!/(?:\.css|\.js|\.svg)$/i.test(url.pathname) && url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(
            (match) =>
                match ||
                caches.open(`${APP_NAME}-${VERSION}`).then((cache) =>
                    fetch(event.request).then((response) => {
                        if (response.status !== 200) {
                            return response;
                        }

                        cache.put(event.request, response.clone());
                        return response;
                    }),
                ),
        ),
    );
});
