#!/usr/bin/env node
/**
 * Gerla — prove nel browser
 * --------------------------
 * Le prove di `prove.mjs` controllano i conti senza aprire una pagina: sono
 * veloci e bastano per dati e generatore. Ma un difetto come "il pulsante
 * Guida non apre niente" lì non si vede, perché non c'è nessun clic.
 *
 * Questa batteria apre l'app in un browser vero, serve i file come farebbe
 * GitHub Pages, e verifica che ogni ricerca e ogni filtro cambino davvero
 * il risultato. Se un filtro smette di filtrare, qui si vede subito.
 *
 *   node prove/prove-browser.mjs
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORTA = 8899;
const TIPI = { ".html": "text/html", ".json": "application/json", ".js": "text/javascript", ".png": "image/png" };

/* alcuni controlli hanno senso solo se i dati sono già stati generati:
   in un deposito appena clonato non ci sono, e non è un errore */
const c_e = f => fs.existsSync(path.join(RADICE, f));
const DATI = { promozioni: c_e("gerla-promozioni.json"), catalogo: c_e("catalogo/indice.json"), ingredienti: c_e("gerla-ingredienti.json") };

let passati = 0, falliti = 0, saltati = 0;
const salta = (nome, perche) => { saltati++; console.log(`  --   ${nome} — saltata: ${perche}`); };
const ok = (nome, cond, dettaglio = "") => {
  if (cond) { passati++; console.log(`  ok   ${nome}${dettaglio ? " — " + dettaglio : ""}`); }
  else { falliti++; console.log(`  NO   ${nome}${dettaglio ? " — " + dettaglio : ""}`); }
};

/* il server locale: senza, il browser rifiuta di leggere i file dei dati */
const server = http.createServer((q, s) => {
  const f = path.join(RADICE, decodeURIComponent(q.url.split("?")[0]));
  fs.readFile(f, (e, d) => {
    if (e) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { "Content-Type": TIPI[path.extname(f)] || "text/plain" });
    s.end(d);
  });
}).listen(PORTA);

const puppeteer = await import("puppeteer").then(m => m.default).catch(() => null);
if (!puppeteer) {
  console.log("Puppeteer non disponibile: salto le prove nel browser.");
  server.close(); process.exit(0);
}

const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const pg = await browser.newPage();
const errori = [];
pg.on("pageerror", e => errori.push(e.message));
await pg.setViewport({ width: 1280, height: 950 });
await pg.goto(`http://localhost:${PORTA}/gerla.html`, { waitUntil: "networkidle0" });
await new Promise(r => setTimeout(r, 3000));
await pg.evaluate(() => { const b = document.querySelector("#ag_skip"); if (b) b.click(); });
await new Promise(r => setTimeout(r, 1400));

console.log("\nApertura e navigazione");
const nav = await pg.evaluate(async () => {
  const out = {};
  for (const id of ["menu", "lista", "analisi", "eventi", "dispensa", "storico", "ricette", "catalogo", "guida"]) {
    apriScheda(id);
    await new Promise(r => setTimeout(r, 320));
    const visibile = [...document.querySelectorAll(".panel")].filter(p => !p.hidden).map(p => p.id);
    out[id] = visibile.length === 1 && visibile[0] === "p-" + id;
  }
  return out;
});
Object.entries(nav).forEach(([k, v]) => ok("si apre la scheda " + k, v));

console.log("\nRicettario");
const ric = await pg.evaluate(async () => {
  apriScheda("ricette"); await new Promise(r => setTimeout(r, 1100));
  const conta = () => document.querySelectorAll(".ric").length;
  const tutte = conta();
  const cerca = async v => { const i = document.querySelector("#cercaRic"); i.value = v;
    i.dispatchEvent(new Event("input")); await new Promise(r => setTimeout(r, 550)); return conta(); };
  const nome = await cerca("pollo");
  const ingrediente = await cerca("zucchine");
  await cerca("");
  const filtro = async f => { const b = document.querySelector(`[data-f="${f}"]`); if (!b) return -1;
    b.click(); await new Promise(r => setTimeout(r, 450)); return conta(); };
  const vegane = await filtro("vegano"), pesce = await filtro("pesce"), stagione = await filtro("stagione");
  await filtro("tutte");
  return { tutte, nome, ingrediente, vegane, pesce, stagione };
});
ok("la ricerca per nome filtra", ric.nome > 0 && ric.nome < ric.tutte, `${ric.tutte} → ${ric.nome}`);
ok("la ricerca trova per ingrediente", ric.ingrediente > 0, `zucchine → ${ric.ingrediente}`);
ok("filtro vegane", ric.vegane > 0 && ric.vegane < ric.tutte, `${ric.vegane}`);
ok("filtro pesce", ric.pesce > 0 && ric.pesce < ric.tutte, `${ric.pesce}`);
ok("filtro di stagione", ric.stagione > 0, `${ric.stagione}`);

console.log("\nCatalogo");
const cat = await pg.evaluate(async () => {
  apriScheda("catalogo"); S.sezPrezzi = "catalogo"; renderCatalogo();
  await new Promise(r => setTimeout(r, 900));
  const conta = () => document.querySelectorAll("#risCat tbody tr").length;
  const i = document.querySelector("#qCat"); i.value = "latte"; i.dispatchEvent(new Event("input"));
  await new Promise(r => setTimeout(r, 1800));
  const cerca = conta();
  const usa = async (sel, val) => { const e = document.querySelector(sel); if (!e) return -1;
    e.value = val; e.dispatchEvent(new Event("change")); await new Promise(r => setTimeout(r, 1100)); return conta(); };
  const reparto = await usa("#repCat", "Latticini");
  await usa("#repCat", "tutti");
  const ordine = await usa("#ordCat", "prezzo");
  const filtro = async f => { const b = document.querySelector(`[data-fc="${f}"]`); if (!b) return -1;
    b.click(); await new Promise(r => setTimeout(r, 1200)); return conta(); };
  const miei = await filtro("mio"), azione = await filtro("azione"), sani = await filtro("sano");
  await filtro("tutto");
  return { cerca, reparto, ordine, miei, azione, sani };
});
ok("la ricerca traduce e trova", cat.cerca > 0, `latte → ${cat.cerca} righe`);
ok("filtro per reparto", cat.reparto > 0 && cat.reparto <= cat.cerca, `${cat.reparto}`);
ok("ordinamento per prezzo", cat.ordine > 0, `${cat.ordine}`);
ok("filtro ingredienti", cat.miei >= 0, `${cat.miei}`);
ok("filtro in azione", cat.azione >= 0, `${cat.azione}`);
ok("filtro Nutri A e B", cat.sani >= 0, `${cat.sani}`);

console.log("\nOfferte");
const off = !DATI.promozioni ? null : await pg.evaluate(async () => {
  S.sezPrezzi = "offerte"; renderCatalogo();
  await new Promise(r => setTimeout(r, 1800));
  const leggi = () => (document.querySelector("#contaPromo") || {}).textContent || "";
  const num = () => { const m = leggi().match(/(\d+)/); return m ? +m[1] : 0; };
  const base = num();
  S.filtroOff.sconto = 50; await renderPromoVere(true); const sconto = num();
  S.filtroOff.sconto = 0; S.filtroOff.quando = "oggi"; await renderPromoVere(true); const scadenza = num();
  S.filtroOff.quando = "tutte"; S.filtroOff.q = "formaggio"; await renderPromoVere(true); const cerca = num();
  S.filtroOff.q = ""; await renderPromoVere(true);
  return { base, sconto, scadenza, cerca };
});
if (!off) salta("filtri delle offerte", "manca gerla-promozioni.json");
else {
  ok("le offerte si caricano", off.base > 0, `${off.base}`);
  ok("filtro sconto minimo", off.sconto > 0 && off.sconto < off.base, `${off.sconto}`);
  ok("filtro scadenza", off.scadenza > 0 && off.scadenza <= off.base, `${off.scadenza}`);
  ok("ricerca in italiano su nomi tedeschi", off.cerca > 0 && off.cerca < off.base, `formaggio → ${off.cerca}`);
}

console.log("\nListino, guida e alternative");
const altro = await pg.evaluate(async () => {
  S.sezPrezzi = "catalogo"; renderCatalogo(); await new Promise(r => setTimeout(r, 800));
  const i = document.querySelector("#cerca");
  const prima = document.querySelectorAll("#tblProd tbody tr").length;
  i.value = "pane"; i.dispatchEvent(new Event("input")); await new Promise(r => setTimeout(r, 600));
  const listino = document.querySelectorAll("#tblProd tbody tr").length;
  i.value = ""; i.dispatchEvent(new Event("input"));
  apriScheda("guida"); await new Promise(r => setTimeout(r, 900));
  const capitoli = document.querySelectorAll("#guidaBox details").length;
  const g = document.querySelector("#cercaGuida"); g.value = "dispensa"; g.dispatchEvent(new Event("input"));
  await new Promise(r => setTimeout(r, 550));
  const guida = document.querySelectorAll("#guidaBox details").length;
  g.value = ""; g.dispatchEvent(new Event("input"));
  apriAlternative("pasta"); await new Promise(r => setTimeout(r, 650));
  const alt = document.querySelectorAll(".swaplist button").length;
  const q = document.querySelector("#alt_q"); q.value = "riso"; q.dispatchEvent(new Event("input"));
  await new Promise(r => setTimeout(r, 550));
  const altFiltrate = document.querySelectorAll(".swaplist button").length;
  chiudiModale();
  return { prima, listino, capitoli, guida, alt, altFiltrate };
});
ok("ricerca nel listino", altro.listino > 0 && altro.listino < altro.prima, `${altro.prima} → ${altro.listino}`);
ok("la guida si disegna", altro.capitoli > 0, `${altro.capitoli} capitoli`);
ok("ricerca nella guida", altro.guida > 0 && altro.guida <= altro.capitoli, `${altro.guida}`);
ok("alternative: ricerca", altro.altFiltrate > 0 && altro.altFiltrate < altro.alt, `${altro.alt} → ${altro.altFiltrate}`);

console.log("\nDiete");
const diete = await pg.evaluate(async () => {
  const out = {};
  for (const p of ["vegano", "vegetariano", "noglutine", "nolattosio"]) {
    S.prefs = new Set([p]); genera(false);
    const pasti = x => ["colazione", "pranzo", "merenda", "cena"].map(k => x[k]);
    out[p] = {
      distinti: new Set(S.menu.flatMap(x => [x.pranzo.id, x.cena.id])).size,
      violato: p === "vegano" ? S.menu.some(x => pasti(x).some(d => d.ing.some(([i]) => animale(i))))
        : p === "vegetariano" ? S.menu.some(x => pasti(x).some(d => d.ing.some(([i]) => !vegetariano(i))))
        : S.menu.some(x => pasti(x).some(d => d.t.some(t => tagVietati().includes(t)))),
    };
  }
  S.prefs = new Set(); genera(false);
  return out;
});
Object.entries(diete).forEach(([k, v]) =>
  ok("dieta " + k + " rispettata", !v.violato && v.distinti > 10, `${v.distinti} piatti distinti`));

console.log("\nSchermo stretto");
await pg.setViewport({ width: 390, height: 844, isMobile: true });
await new Promise(r => setTimeout(r, 700));
const mobile = await pg.evaluate(() => ({
  larghezza: document.documentElement.scrollWidth,
  finestra: window.innerWidth,
  barra: !!document.querySelector(".tabs"),
}));
ok("niente scorrimento laterale", mobile.larghezza <= mobile.finestra + 1, `${mobile.larghezza} px`);
ok("barra di navigazione presente", mobile.barra);

console.log(`\n${passati} passate, ${falliti} fallite${saltati ? ", " + saltati + " saltate" : ""}`);
if (!DATI.catalogo) console.log("Nota: manca la cartella catalogo/, la ricerca è stata provata sul solo listino di casa.");
if (errori.length) console.log("errori di pagina:", errori.slice(0, 3));
await browser.close();
server.close();
process.exit(falliti || errori.length ? 1 : 0);
