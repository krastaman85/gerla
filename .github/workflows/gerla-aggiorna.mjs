#!/usr/bin/env node
/**
 * Gerla — aggiornamento del listino da fonti reali
 * ------------------------------------------------
 * Uso:   node gerla-aggiorna.mjs [--out gerla-listino.json] [--html gerla.html]
 *
 * Legge il catalogo prodotti direttamente dal file gerla.html (blocco RAW),
 * interroga le fonti aperte elencate in FONTI, incrocia i risultati con il
 * catalogo e riscrive il listino JSON che l'app carica a ogni apertura.
 *
 * Nessuna fonte viene forzata: se un sito blocca o cambia struttura, lo script
 * lo segnala e lascia intatto il prezzo precedente. Meglio un prezzo vecchio
 * dichiarato che un prezzo inventato.
 */
import fs from "node:fs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg("--out", "gerla-listino.json");
const HTML = arg("--html", "gerla.html");
const UA = "Gerla/1.0 (pianificatore spesa personale; contatto: uso privato)";
const oggi = new Date().toISOString().slice(0, 10);

/* =========================================================
   1. FONTI — il database delle sorgenti di prezzo
   tipo:  api      → dati strutturati, estrazione automatica affidabile
          csv      → file aperto, estrazione automatica
          html     → pagina pubblica, estrazione best effort
          manuale  → serve l'occhio umano (l'app ci manda con un clic)
   ========================================================= */
export const FONTI = [
  { id:"off-prices-ch", nome:"Open Food Facts Prices — Svizzera", tipo:"api", zona:"CH",
    url:"https://prices.openfoodfacts.org/api/v1/prices?currency=CHF&order_by=-date&size=100",
    licenza:"ODbL", da:"prezzi fotografati allo scaffale dalla comunità", auto:true },
  { id:"off-prices-it", nome:"Open Food Facts Prices — Italia", tipo:"api", zona:"IT",
    url:"https://prices.openfoodfacts.org/api/v1/prices?currency=EUR&order_by=-date&size=100",
    licenza:"ODbL", da:"prezzi fotografati allo scaffale dalla comunità", auto:true },
  { id:"mimit-carburanti", nome:"MIMIT — prezzi carburanti Italia", tipo:"csv", zona:"IT",
    url:"https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv",
    licenza:"open data", da:"prezzi ufficiali di ogni distributore italiano", auto:true },
  { id:"tcs-carburanti", nome:"TCS — prezzi medi carburante Svizzera", tipo:"manuale", zona:"CH",
    url:"https://www.tcs.ch/it/camping-viaggi/informazioni-turistiche/utile-da-sapere/costi-di-viaggio-e-pedaggi/prezzi-carburante.php",
    da:"media nazionale benzina 95/98 e diesel", auto:false },
  { id:"lidl-ch", nome:"Lidl Svizzera — volantini PDF", tipo:"manuale", zona:"CH",
    url:"https://www.lidl.ch/c/it-CH/volantini-in-pdf/s10019683", auto:false },
  { id:"coop-promo", nome:"Coop — promozioni", tipo:"manuale", zona:"CH",
    url:"https://www.coop.ch/it/promozioni.html", auto:false },
  { id:"rabatt-kompass", nome:"Rabatt Kompass — volantini CH", tipo:"html", zona:"CH",
    url:"https://it.rabatt-kompass.ch/", auto:false },
  { id:"aktionis", nome:"Aktionis — volantini CH", tipo:"html", zona:"CH",
    url:"https://www.aktionis.ch/it/", auto:false },
  { id:"rappn", nome:"Rappn — confronto prezzi CH", tipo:"manuale", zona:"CH",
    url:"https://rappn.ch/it/", auto:false },
  { id:"esselunga", nome:"Esselunga — volantini", tipo:"manuale", zona:"IT",
    url:"https://www.esselunga.it/it-it/promozioni/volantini.html", auto:false },
  { id:"lidl-it", nome:"Lidl Italia — volantino", tipo:"manuale", zona:"IT",
    url:"https://www.lidl.it/c/it-IT/volantino/s10018048", auto:false },
  { id:"eurospin", nome:"Eurospin — volantino", tipo:"manuale", zona:"IT",
    url:"https://www.eurospin.it/volantino/", auto:false },
  { id:"promoqui", nome:"PromoQui — volantini IT", tipo:"html", zona:"IT",
    url:"https://www.promoqui.it/", auto:false },
  { id:"volantinofacile", nome:"Volantino Facile — volantini IT", tipo:"html", zona:"IT",
    url:"https://www.volantinofacile.it/", auto:false },
];

/* cambio EUR→CHF: aggiornato dalla BCE se raggiungibile, altrimenti prudente */
let CAMBIO = 0.94;

/* =========================================================
   2. CATALOGO — letto dal file dell'app, così resta una sola verità
   ========================================================= */
function leggiCatalogo(file) {
  const src = fs.readFileSync(file, "utf8");
  const blocco = src.slice(src.indexOf("const RAW = ["), src.indexOf("const PROD = {}"));
  const righe = [...blocco.matchAll(/\["([^"]+)","((?:[^"\\]|\\.)*)","([^"]+)",([\d.]+),([\d.]+),"([^"]+)"/g)];
  return righe.map(m => ({
    id: m[1],
    nome: JSON.parse('"' + m[2] + '"'),
    cat: m[3],
    p: +m[4],
    pu: +m[5],
    um: m[6],
  }));
}

/* parole da ignorare quando confronto i nomi */
const STOP = new Set(["di","da","del","della","al","alla","in","e","con","per","il","la","lo","gli","le","un","una","fresco","fresca","surgelato","surgelati","scatola","bottiglia"]);
const norm = s => s.toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const chiavi = s => norm(s).split(" ").filter(w => w.length > 3 && !STOP.has(w));

/* sinonimi: il catalogo parla italiano di casa, i dati aperti parlano di tutto */
const SINONIMI = {
  pasta:["spaghetti","penne","fusilli","teigwaren","pates"], riso:["reis","rice"],
  latte:["milch","lait","vollmilch"], burro:["butter","beurre"], uova:["eier","oeufs","egg"],
  pane:["brot","pain","bread"], farina:["mehl","farine","flour"], zucchero:["zucker","sucre","sugar"],
  caffe:["kaffee","cafe","coffee","espresso"], olio:["olivenol","huile","olive oil"],
  yogurtnat:["joghurt","yogourt","nature"], mozzarella:["mozzarella"], pettopollo:["poulet","huhn","chicken","pollo"],
  macinato:["hackfleisch","viande hachee","macinata"], patate:["kartoffeln","pommes de terre"],
  pomodori:["tomaten","tomates","tomato"], mele:["apfel","pomme","apple"], banane:["banane","banana"],
  tonno:["thon","thunfisch","tuna"], birra:["bier","biere","beer"], vinorosso:["rotwein","vin rouge"],
  vinobianco:["weisswein","vin blanc"], cioccolato:["schokolade","chocolat","chocolate"],
  biscotti:["biscuits","guetzli","kekse"], gelato:["glace","eis","ice cream"], parmigiano:["parmesan","sbrinz","grana"],
};

/* =========================================================
   3. RETE
   ========================================================= */
async function prendi(url, { json = false, timeout = 20000 } = {}) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), timeout);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": UA, "Accept-Language": "it-CH,it;q=0.9", ...(json ? { Accept: "application/json" } : {}) } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return json ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

async function cambioEuro() {
  try {
    const j = await prendi("https://api.frankfurter.app/latest?from=EUR&to=CHF", { json: true, timeout: 10000 });
    if (j?.rates?.CHF) { CAMBIO = j.rates.CHF; return { ok: true, val: CAMBIO, data: j.date }; }
  } catch (e) { return { ok: false, err: e.message }; }
  return { ok: false };
}

/* =========================================================
   4. ADATTATORE OPEN FOOD FACTS PRICES
   ========================================================= */
async function offPrices(valuta, pagine) {
  const out = [];
  for (let p = 1; p <= pagine; p++) {
    const u = `https://prices.openfoodfacts.org/api/v1/prices?currency=${valuta}&order_by=-date&size=100&page=${p}`;
    let j;
    try { j = await prendi(u, { json: true }); } catch (e) { break; }
    if (!j.items || !j.items.length) break;
    for (const it of j.items) {
      const pr = it.product;
      if (!pr || !pr.product_name || !it.price) continue;
      out.push({
        nome: pr.product_name,
        marca: pr.brands || "",
        q: pr.product_quantity || null,
        um: (pr.product_quantity_unit || "g").toLowerCase(),
        prezzo: +it.price,
        valuta,
        negozio: it.location?.osm_brand || it.location?.osm_name || "",
        paese: it.location?.osm_address_country_code || "",
        data: it.date,
      });
    }
    if (j.items.length < 100) break;
  }
  return out;
}

/* incrocio osservazioni e catalogo */
function incrocia(catalogo, osservazioni) {
  const risultati = {};
  const indice = catalogo.map(p => ({ p, k: [...chiavi(p.nome), ...(SINONIMI[p.id] || [])] }));
  for (const o of osservazioni) {
    // solo negozi svizzeri e italiani: un prezzo di Lione non dice nulla su Lugano
    if (o.paese && !["CH","IT"].includes(o.paese)) continue;
    const n = norm(o.nome + " " + o.marca);
    for (const { p, k } of indice) {
      if (!k.length) continue;
      if (!k.some(w => n.includes(w))) continue;
      if (p.um !== "pz" && o.q && o.um && (o.um === "g" || o.um === "ml")) {
        // riporto il prezzo al formato del nostro catalogo
        const perUnita = o.prezzo / o.q;
        const stimato = perUnita * p.pu;
        if (!isFinite(stimato) || stimato <= 0 || stimato > p.p * 2.2 || stimato < p.p * 0.45) continue;
        (risultati[p.id] = risultati[p.id] || []).push({ v: o.valuta === "EUR" ? stimato * CAMBIO : stimato, o });
      } else if (o.q == null) {
        const v = o.valuta === "EUR" ? o.prezzo * CAMBIO : o.prezzo;
        if (v > p.p * 2.2 || v < p.p * 0.45) continue;
        (risultati[p.id] = risultati[p.id] || []).push({ v, o });
      }
      break;
    }
  }
  const finale = {};
  const MIN_OSS = 3;   // sotto tre rilevazioni non mi fido
  for (const [id, arr] of Object.entries(risultati)) {
    if (arr.length < MIN_OSS) continue;
    const v = arr.map(x => x.v).sort((a, b) => a - b);
    const mediana = v[Math.floor(v.length / 2)];
    finale[id] = {
      p: Math.round(mediana * 20) / 20,
      n: v.length,
      fonte: "off-prices",
      data: arr.map(x => x.o.data).sort().pop(),
      negozi: [...new Set(arr.map(x => x.o.negozio).filter(Boolean))].slice(0, 3),
    };
  }
  return finale;
}

/* indici per insegna: confronto lo stesso prodotto tra catene diverse */
function indiciDaiDati(catalogo, osservazioni) {
  const MARCHE = {
    "Migros":"migros","Coop":"coop","Denner":"denner","Aldi":"aldi","Aldi Suisse":"aldi",
    "Lidl":"lidlch","Manor":"manor","Volg":"volg","Otto's":"ottos","Landi":"landi","Migrolino":"migrolino",
    "Esselunga":"esselunga","Iper":"iper","Conad":"conad","Carrefour":"carrefour","Bennet":"bennet",
    "Tigros":"tigros","Iperal":"iperal","Eurospin":"eurospin","MD":"md","Pam":"pam",
  };
  const perProdotto = {};   // nomeNormalizzato -> { insegna: [prezzi al kg/l] }
  for (const o of osservazioni) {
    if (!o.negozio || !o.q || !["g","ml"].includes(o.um)) continue;
    const ins = MARCHE[o.negozio]; if (!ins) continue;
    const chiave = norm(o.nome).split(" ").slice(0, 2).join(" ");
    if (chiave.length < 5) continue;
    const perUnita = (o.valuta === "EUR" ? o.prezzo * CAMBIO : o.prezzo) / o.q * 1000;
    if (!isFinite(perUnita) || perUnita <= 0) continue;
    ((perProdotto[chiave] = perProdotto[chiave] || {})[ins] ||= []).push(perUnita);
  }
  // per ogni prodotto presente in almeno due insegne, rapporto rispetto alla mediana generale
  const rapporti = {};
  for (const [, perIns] of Object.entries(perProdotto)) {
    const insegne = Object.keys(perIns);
    if (insegne.length < 2) continue;
    // mediana delle mediane di ciascuna insegna: così una catena con molte
    // rilevazioni non diventa da sola il riferimento
    const medPerIns = {};
    for (const i of insegne) {
      const v = perIns[i].slice().sort((a, b) => a - b);
      medPerIns[i] = v[Math.floor(v.length / 2)];
    }
    const base = Object.values(medPerIns).sort((a, b) => a - b);
    const rif = base.length % 2 ? base[(base.length - 1) / 2] : (base[base.length / 2 - 1] + base[base.length / 2]) / 2;
    for (const i of insegne) (rapporti[i] = rapporti[i] || []).push(medPerIns[i] / rif);
  }
  const out = {};
  for (const [ins, arr] of Object.entries(rapporti)) {
    if (arr.length < 4) continue;                       // servono almeno quattro prodotti in comune
    const v = arr.sort((a, b) => a - b);
    const med = v[Math.floor(v.length / 2)];
    // sostituisco l'indice tarato a mano solo se il dato è abbastanza solido
    // e dice qualcosa di diverso: un 1.00 ricavato da quattro confronti non è un'informazione
    if (med > 0.35 && med < 2.2 && arr.length >= 6 && Math.abs(med - 1) > 0.05)
      out[ins] = { k: Math.round(med * 100) / 100, n: arr.length };
  }
  return out;
}

/* =========================================================
   5. CARBURANTI
   ========================================================= */
const PROV_LOMBARDIA = new Set(["CO","VA","LC","SO","MI","MB","LO","BG","PV","CR","BS","MN"]);
const PROV_CONFINE = new Set(["CO","VA","LC","SO"]);   // quelle dove ha senso andare dal Ticino

async function carburanti() {
  const out = {
    ch: { benzina95: 1.92, diesel: 2.11, elettrico_kwh: 0.35, fonte: "TCS — rilevazione manuale", data: oggi },
    it: { benzina: null, diesel: null, fonte: "MIMIT", data: null },
  };
  try {
    const base = "https://www.mimit.gov.it/images/exportCSV/";
    const [prezzi, anagrafica] = await Promise.all([
      prendi(base + "prezzo_alle_8.csv", { timeout: 120000 }),
      prendi(base + "anagrafica_impianti_attivi.csv", { timeout: 120000 }),
    ]);
    // i file MIMIT usano la barra verticale come separatore, non il punto e virgola
    const provincia = new Map();
    for (const r of anagrafica.split("\n").slice(2)) {
      const c = r.split("|");
      if (c.length > 7) provincia.set(c[0], c[7].trim());
    }
    const raccolta = { confine: { b: [], d: [] }, lombardia: { b: [], d: [] }, italia: { b: [], d: [] } };
    for (const r of prezzi.split("\n").slice(2)) {
      const c = r.split("|");
      if (c.length < 4) continue;
      if (c[3].trim() !== "1") continue;                  // solo self service
      const p = parseFloat(c[2]);
      if (!isFinite(p) || p < 0.8 || p > 3.5) continue;
      const tipo = c[1].toLowerCase();
      const q = tipo.includes("benzina") ? "b" : (tipo.includes("gasolio") || tipo.includes("diesel")) ? "d" : null;
      if (!q) continue;
      const pr = provincia.get(c[0]);
      raccolta.italia[q].push(p);
      if (pr && PROV_LOMBARDIA.has(pr)) raccolta.lombardia[q].push(p);
      if (pr && PROV_CONFINE.has(pr)) raccolta.confine[q].push(p);
    }
    const med = a => { if (!a.length) return null; a.sort((x, y) => x - y); return +a[Math.floor(a.length / 2)].toFixed(3); };
    // uso le province di confine se il campione basta, altrimenti allargo
    const scelta = raccolta.confine.b.length >= 40 ? "confine"
                 : raccolta.lombardia.b.length >= 40 ? "lombardia" : "italia";
    out.it.benzina = med(raccolta[scelta].b);
    out.it.diesel  = med(raccolta[scelta].d);
    out.it.zona    = scelta === "confine" ? "Como, Varese, Lecco, Sondrio" : scelta === "lombardia" ? "Lombardia" : "Italia";
    out.it.campione = raccolta[scelta].b.length + raccolta[scelta].d.length;
    out.it.data = oggi;
    out.it.confronto = { lombardia: { benzina: med(raccolta.lombardia.b), diesel: med(raccolta.lombardia.d) },
                         italia:    { benzina: med(raccolta.italia.b),    diesel: med(raccolta.italia.d) } };
  } catch (e) { out.it.errore = e.message; }
  return out;
}

/* =========================================================
   6. ESECUZIONE
   ========================================================= */
async function main() {
  const rapporto = { data: oggi, fonti: [] };
  const catalogo = leggiCatalogo(HTML);
  console.log(`Catalogo: ${catalogo.length} prodotti letti da ${HTML}`);

  const c = await cambioEuro();
  rapporto.cambioEUR = CAMBIO;
  console.log(`Cambio EUR→CHF: ${CAMBIO}${c.ok ? " (BCE " + c.data + ")" : " (valore prudenziale)"}`);

  let osservazioni = [];
  for (const [id, valuta, pagine] of [["off-prices-ch", "CHF", 25], ["off-prices-it", "EUR", 25]]) {
    try {
      const o = await offPrices(valuta, pagine);
      osservazioni = osservazioni.concat(o);
      rapporto.fonti.push({ id, stato: "ok", osservazioni: o.length });
      console.log(`  ${id}: ${o.length} osservazioni`);
    } catch (e) {
      rapporto.fonti.push({ id, stato: "errore", errore: e.message });
      console.log(`  ${id}: ERRORE ${e.message}`);
    }
  }

  const trovati = incrocia(catalogo, osservazioni);
  const indiciReali = indiciDaiDati(catalogo, osservazioni);
  if (Object.keys(indiciReali).length)
    console.log("Indici osservati (informativi):", Object.entries(indiciReali).map(([i, v]) => `${i} ${v.k} su ${v.n} confronti`).join(", "));
  else console.log("Indici osservati: dati ancora insufficienti per un confronto tra insegne");
  console.log(`Incrocio: ${Object.keys(trovati).length} prodotti con prezzo reale`);

  const carb = await carburanti();
  console.log(`Carburanti ${carb.it.zona ?? "IT"}: benzina €${carb.it.benzina ?? "—"} diesel €${carb.it.diesel ?? "—"} su ${carb.it.campione ?? 0} rilevazioni${carb.it.errore ? " — " + carb.it.errore : ""}`);

  /* listino precedente: i prezzi non confermati restano com'erano */
  let vecchio = {};
  try { vecchio = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) {}

  const prezzi = { ...(vecchio.prezzi || {}) };
  const qualita = { ...(vecchio.qualita || {}) };
  for (const p of catalogo) if (prezzi[p.id] === undefined) { prezzi[p.id] = p.p; qualita[p.id] = { q: "riferimento" }; }
  for (const [id, r] of Object.entries(trovati)) {
    prezzi[id] = r.p;
    qualita[id] = { q: "verificato", n: r.n, data: r.data, fonte: r.fonte, negozi: r.negozi };
  }

  const listino = {
    versione: 3,
    data: oggi,
    generato: new Date().toISOString(),
    nota: "Listino Gerla. Prezzi 'verificato' incrociati con fonti aperte; gli altri sono valori di riferimento da correggere allo scaffale.",
    cambioEUR: CAMBIO,
    prezzi,
    qualita,
    // gli indici calcolati restano informativi: con pochi confronti sono instabili
    // (la stessa catena può uscire 0.74 un giorno e 1.34 il giorno dopo) e sovrascriverli
    // peggiorerebbe una taratura fatta a mano. Li pubblico per poterli guardare crescere.
    indici: vecchio.indici || {},
    indiciOsservati: indiciReali,
    promo: vecchio.promo || {},
    carburanti: carb,
    fonti: FONTI.map(f => ({ id: f.id, nome: f.nome, tipo: f.tipo, zona: f.zona, url: f.url, auto: !!f.auto })),
    rapporto,
  };
  fs.writeFileSync(OUT, JSON.stringify(listino, null, 1));
  const ver = Object.values(qualita).filter(q => q.q === "verificato").length;
  console.log(`Scritto ${OUT}: ${Object.keys(prezzi).length} prezzi, di cui ${ver} verificati dal web.`);
}

main().catch(e => { console.error("Errore:", e); process.exit(1); });
