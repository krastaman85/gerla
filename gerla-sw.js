/* Gerla — funzionamento senza rete
   I magazzini di Migros e Coop in Ticino sono spesso interrati, senza campo:
   la modalità spesa è la funzione che serve di più proprio dove la rete manca.
   Qui l'app e i suoi dati vengono tenuti da parte, e se la rete non c'è si usa
   l'ultima copia buona invece di mostrare una pagina vuota. */
const VERSIONE = "gerla-v1";
const ESSENZIALI = ["./", "./gerla.html", "./manifest.json"];
const DATI = ["gerla-listino.json", "gerla-ingredienti.json", "gerla-promozioni.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(ESSENZIALI)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  const eDato = DATI.some(d => url.pathname.endsWith(d)) || url.pathname.includes("/catalogo/");

  if (eDato) {
    /* prima la rete, poi la copia: i prezzi devono essere freschi quando si può */
    e.respondWith(
      fetch(e.request).then(r => {
        const copia = r.clone();
        caches.open(VERSIONE).then(c => c.put(e.request, copia));
        return r;
      }).catch(() => caches.match(e.request).then(r => r || new Response("{}", { headers: { "Content-Type": "application/json" } })))
    );
    return;
  }
  /* l'applicazione: prima la copia, così si apre subito anche in corsia */
  e.respondWith(
    caches.match(e.request).then(c => {
      const rete = fetch(e.request).then(r => {
        const copia = r.clone();
        caches.open(VERSIONE).then(x => x.put(e.request, copia));
        return r;
      }).catch(() => c);
      return c || rete;
    })
  );
});
