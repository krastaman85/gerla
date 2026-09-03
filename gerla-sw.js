/* Gerla — funzionamento senza rete
   I magazzini di Migros e Coop in Ticino sono spesso interrati, senza campo:
   la modalità spesa è la funzione che serve di più proprio dove la rete manca.
   Qui l'app e i suoi dati vengono tenuti da parte, e se la rete non c'è si usa
   l'ultima copia buona invece di mostrare una pagina vuota. */
/* La versione va cambiata a ogni pubblicazione: è ciò che dice al telefono
   "questa copia è vecchia, buttala". Senza, l'app installata resta ferma
   a quella scaricata la prima volta. */
const VERSIONE = "gerla-2026-09-03-bc8d25f2";
/* Attenzione: addAll fallisce in blocco se anche un solo indirizzo non risponde,
   e l'installazione salta senza dire niente. La cartella "./" non esiste come
   pagina (l'app è gerla.html), quindi la chiedevamo invano e il service worker
   non veniva installato mai. Qui ogni file si mette da parte per conto suo. */
const ESSENZIALI = ["./gerla.html", "./manifest.json", "./icona-192.png", "./icona-512.png", "./icona-apple.png", "./icona-maskable.png"];
const DATI = ["gerla-listino.json", "gerla-ingredienti.json", "gerla-promozioni.json"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSIONE);
    await Promise.all(ESSENZIALI.map(u =>
      c.add(u).catch(err => console.log("Gerla: non ho potuto mettere da parte " + u, err))));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== VERSIONE).map(x => caches.delete(x))))
    .then(() => self.clients.claim()));
});
/* l'app può chiedere di passare subito alla versione nuova */
self.addEventListener("message", e => { if (e.data === "aggiorna") self.skipWaiting(); });

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
  /* l'applicazione: mostro subito la copia (così si apre anche in corsia)
     ma intanto scarico la versione nuova per la volta successiva */
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
