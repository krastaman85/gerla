#!/usr/bin/env node
/**
 * Gerla — legatura fra ingredienti e prodotti veri
 * -------------------------------------------------
 *   node gerla-lega.mjs --html gerla.html --catalogo catalogo --out gerla-ingredienti.json
 *
 * Le ricette parlano di "latte", "pasta", "petto di pollo": concetti.
 * I negozi vendono "Valflora Vollmilch 3.5% UHT 1l": oggetti, che cambiano
 * ogni settimana e sono diversi in ogni catena. Serve un ponte, e questo
 * script lo costruisce da solo: per ogni ingrediente cerca nel catalogo
 * scaricato i prodotti che gli corrispondono davvero, e sceglie il più
 * conveniente in ogni negozio.
 *
 * Il filtro decisivo non è il nome ma la CATEGORIA: cercando "Milch" per
 * nome escono 216 articoli, fra cui formaggini e dessert; limitando la
 * ricerca alle categorie del latte ne restano pochi e giusti.
 *
 * Da qui in poi i prezzi dell'app non sono più stime scritte a mano:
 * sono prezzi di prodotti reali, con nome, formato e negozio.
 */
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const HTML = arg("--html", "gerla.html");
const CART = arg("--catalogo", "catalogo");
const OUT = arg("--out", "gerla-ingredienti.json");

/* ---------- categorie ammesse per ogni reparto ---------- */
const CATEGORIE = {
  Verdura:    ["fresh_vegetables","salad_greens","frozen_fruit_and_veg","herbs_and_spices","fresh_pasta_and_soup"],
  Frutta:     ["fresh_fruit","frozen_fruit_and_veg","nuts_and_dried_fruit"],
  Carne:      ["poultry","beef","pork","deli_and_charcuterie","meat_other","frozen_meat_and_seafood","par_and_raw"],
  Pesce:      ["seafood_and_fish","frozen_meat_and_seafood","canned_and_jarred"],
  Proteine:   ["eggs_category","plant_based","dairy_alternatives"],
  Legumi:     ["canned_and_jarred","plant_based","grains_pasta_and_rice","world_foods"],
  Latticini:  ["milk","cheese","yogurt_and_dessert","cream_and_butter","dairy_alternatives"],
  Carboidrati:["grains_pasta_and_rice","bread_and_loaves","baked_goods","fresh_pasta_and_soup","baking_and_spices"],
  Colazione:  ["cereals_and_breakfast","spreads_and_preserves","baked_goods","chocolate","snack_bars","candy_and_gummies"],
  Dispensa:   ["sauces_oils_and_vinegars","baking_and_spices","canned_and_jarred","soups_and_stock","world_foods",
               "salty_snacks","chocolate","coffee","tea","spreads_and_preserves","grains_pasta_and_rice","herbs_and_spices"],
  Bevande:    ["soft_drinks","water","juice_and_smoothies","beer_and_cider","wine","spirits",
               "champagne_and_sparkling","aperitifs_and_liqueurs","coffee","tea"],
  Casa:       ["cleaning_and_household","paper_and_disposables","laundry","kitchen_and_home","pet"],
  Igiene:     ["personal_care","health_and_wellness","baby_and_kids","beauty"],
};

/* alcune parole tradiscono un prodotto diverso da quello cercato:
   "Milch" dentro "Milchschokolade" non è latte */
const ESCLUDI = {
  latte:["schokolade","schoggi","dessert","kaffee","riegel","glace","pudding","creme","joghurt","kase","pizza"],
  riso:["kekse","waffeln","drink","milch","chips","riegel","kuchen"],
  pettopollo:["cervelas","wurst","aufschnitt","salami","terrine","pate","suppe"],
  mozzarella:["pizza","salat","sauce","aufschnitt"],
  burro:["butterzopf","keks","guetzli","gebäck","gebaeck","kuchen","erdnuss","zigerbutter","kraut"],
  pane:["kuchen","dessert","paniermehl","pizza","cracker"],
  uova:["likor","likör","nudeln","teigwaren","pasta","schokolade","zopf"],
};

/* ---------- termini di ricerca per ingrediente ---------- */
import { SK_TERMINI } from "./gerla-skrimpers.mjs";

const normalizza = t => (t || "").toLowerCase()
  .replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u").replace(/ß/g,"ss")
  .replace(/[àèéìòù]/g,c=>({"à":"a","è":"e","é":"e","ì":"i","ò":"o","ù":"u"}[c]))
  .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();

function terminiPer(p) {
  const t = new Set();
  const de = SK_TERMINI[p.id];
  if (de) de.split(/\s+/).forEach(w => { if (w.length > 3) t.add(normalizza(w)); });
  normalizza(p.nome).split(" ").forEach(w => { if (w.length > 4) t.add(w); });
  return [...t];
}

/* ---------- lettura del catalogo dei negozi ---------- */
function leggiCatalogo() {
  const negozi = {};
  if (!fs.existsSync(CART)) {
    console.log(`La cartella ${CART}/ non c'è: senza catalogo non posso legare niente.`);
    return negozi;
  }
  for (const f of fs.readdirSync(CART)) {
    if (!f.endsWith(".json") || f === "indice.json") continue;
    let j;
    /* un file rovinato non deve far cadere tutto il giro: lo salto e lo dico */
    try { j = JSON.parse(fs.readFileSync(path.join(CART, f), "utf8")); }
    catch (e) { console.log(`  ${f}: illeggibile (${e.message.slice(0, 40)}), lo salto`); continue; }
    if (!j || !j.negozio || !j.voci) { console.log(`  ${f}: formato inatteso, lo salto`); continue; }
    negozi[j.negozio] = Object.entries(j.voci).map(([id, v]) => ({
      id, n: v[0], m: v[1], f: v[2], p: v[3], pu: v[4], u: (v[5] || "").toLowerCase(),
      nu: v[6], c: v[7], az: v[8], nn: normalizza(v[0] + " " + v[1]),
    }));
  }
  return negozi;
}

/* ---------- il catalogo dell'app, che qui diventa l'elenco degli ingredienti ---------- */
function leggiIngredienti() {
  const src = fs.readFileSync(HTML, "utf8");
  const blocco = src.slice(src.indexOf("const RAW = ["), src.indexOf("const PROD = {}"));
  return [...blocco.matchAll(/\["([^"]+)","((?:[^"\\]|\\.)*)","([^"]+)",([\d.]+),([\d.]+),"([^"]+)"/g)]
    .map(m => ({ id: m[1], nome: JSON.parse('"' + m[2] + '"'), cat: m[3], p: +m[4], pu: +m[5], um: m[6] }));
}

/* ---------- prezzo del prodotto riportato al formato dell'ingrediente ---------- */
function prezzoPerFormato(x, ing) {
  if (!(x.p > 0)) return null;
  const u = x.u;
  if (ing.um === "g"  && /kg/.test(u))    return x.pu * ing.pu / 1000;
  if (ing.um === "g"  && /100\s*g/.test(u)) return x.pu * 10 * ing.pu / 1000;
  if (ing.um === "ml" && /^l$|\/l|liter/.test(u)) return x.pu * ing.pu / 1000;
  if (ing.um === "ml" && /100\s*ml/.test(u)) return x.pu * 10 * ing.pu / 1000;
  if (ing.um === "pz") {
    const q = (x.f || "").match(/(\d+)\s*(stk|stück|pz|x)/i);
    const n = q ? +q[1] : 1;
    return n > 0 ? x.p / n * ing.pu : x.p * ing.pu;
  }
  return null;
}

/* ---------- il cuore: per ogni ingrediente, i prodotti veri ---------- */
function lega(ingredienti, negozi) {
  const out = {};
  const rapporto = { legati: 0, senza: [], perNegozio: {} };

  for (const ing of ingredienti) {
    const termini = terminiPer(ing);
    if (!termini.length) { rapporto.senza.push(ing.id); continue; }
    const categorie = CATEGORIE[ing.cat] || [];
    const scelte = {};

    for (const [neg, prodotti] of Object.entries(negozi)) {
      const candidati = [];
      for (const x of prodotti) {
        if (!termini.some(t => x.nn.includes(t))) continue;
        if (categorie.length && x.c && !categorie.includes(x.c)) continue;   // la categoria fa il grosso del lavoro
        const v = prezzoPerFormato(x, ing);
        if (!(v > 0)) continue;
        candidati.push({ x, v });
      }
      if (!candidati.length) continue;

      /* il più conveniente è quasi sempre l'abbinamento sbagliato: la pizza
         alla mozzarella costa meno della mozzarella. Scelgo quindi per
         pertinenza — la parola cercata deve essere la testa del nome, non
         una comparsa — e fra i pertinenti prendo il prezzo mediano. */
      const esclusi = ESCLUDI[ing.id] || [];
      const pertinenti = candidati.filter(c => !esclusi.some(e => c.x.nn.includes(e)));
      const lista = pertinenti.length ? pertinenti : candidati;
      lista.forEach(c => {
        const parole = c.x.nn.split(" ");
        const pos = Math.min(...termini.map(t => { const i = parole.findIndex(w => w.startsWith(t)); return i < 0 ? 99 : i; }));
        const esatta = termini.some(t => parole.includes(t));
        c.punti = (esatta ? 0 : 6) + Math.min(pos, 8) + parole.length * 0.25;
      });
      lista.sort((a, b) => a.punti - b.punti);
      const soglia = lista[0].punti + 2;
      const buoni = lista.filter(c => c.punti <= soglia).sort((a, b) => a.v - b.v);
      if (!buoni.length) continue;
      let scelto = buoni[Math.floor(buoni.length * 0.35)] || buoni[0];   // verso il basso, ma non l'estremo
      const corr = CORREZIONI[ing.id] && CORREZIONI[ing.id][neg];
      if (corr) {                                    // se una persona ha corretto, comanda la persona
        const forzato = candidati.find(c => c.x.id === corr) || lista.find(c => c.x.id === corr);
        if (forzato) scelto = forzato;
      }
      /* "in questo negozio non c'è nulla di adatto": non ne propongo un altro,
         il prezzo torna a essere quello di riferimento */
      const negoziEsclusi = CORREZIONI["__esclusi__"] || {};
      if ((negoziEsclusi[ing.id] || []).includes(neg)) continue;
      const scartati = CORREZIONI["__scartati__"] || {};
      if ((scartati[ing.id] || []).includes(scelto.x.id)) {
        const pulito = buoni.find(c => !(scartati[ing.id] || []).includes(c.x.id));
        if (pulito) scelto = pulito; else continue;
      }
      scelte[neg] = {
        sku: scelto.x.id, n: scelto.x.n, m: scelto.x.m || "", f: scelto.x.f || "",
        p: Math.round(scelto.v * 20) / 20,
        pcf: scelto.x.p, pu: scelto.x.pu || null, u: scelto.x.u || "",
        nu: scelto.x.nu || "", az: scelto.x.az ? 1 : 0,
        /* le altre corrispondenze plausibili: servono a correggere l'abbinamento
           con un clic, senza dover interrogare di nuovo i negozi */
        alt: buoni.slice(0, 6).filter(c => c.x.id !== scelto.x.id).map(c => ({
          sku: c.x.id, n: c.x.n, f: c.x.f || "", p: Math.round(c.v * 20) / 20, pcf: c.x.p, nu: c.x.nu || "",
        })),
      };
      rapporto.perNegozio[neg] = (rapporto.perNegozio[neg] || 0) + 1;
    }

    if (!Object.keys(scelte).length) { rapporto.senza.push(ing.id); continue; }
    const prezzi = Object.values(scelte).map(s => s.p);
    const nutri = Object.values(scelte).map(s => s.nu).filter(Boolean);
    const conta = {}; nutri.forEach(g => conta[g] = (conta[g] || 0) + 1);
    const nutriScelto = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];

    out[ing.id] = {
      base: Math.min(...prezzi),
      negozi: scelte,
      nutri: nutriScelto ? { g: nutriScelto[0], n: nutri.length, sicurezza: Math.round(nutriScelto[1] / nutri.length * 100) } : null,
    };
    rapporto.legati++;
  }
  return { out, rapporto };
}

/* --------------------------------------------------------- */
/* correzioni scritte a mano dall'app: ingrediente -> sku scelto dall'utente */
let CORREZIONI = {};
try { CORREZIONI = JSON.parse(fs.readFileSync("gerla-correzioni.json", "utf8")).voci || {}; } catch (e) {}
if (Object.keys(CORREZIONI).length) console.log(`Correzioni manuali applicate: ${Object.keys(CORREZIONI).length}`);

const ingredienti = leggiIngredienti();
const negozi = leggiCatalogo();
console.log(`Ingredienti: ${ingredienti.length} · negozi: ${Object.keys(negozi).length} · prodotti veri: ${Object.values(negozi).reduce((a, x) => a + x.length, 0)}`);

const { out, rapporto } = lega(ingredienti, negozi);

/* Rete di sicurezza: se il giro nuovo lega molto meno di quello vecchio,
   qualcosa è andato storto (catalogo a metà, negozi che non rispondono).
   Pubblicare un file più povero cancellerebbe i prezzi veri già raccolti. */
let precedente = null;
try { precedente = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) {}
const negoziOra = Object.keys(negozi).length;
const negoziPrima = precedente ? (precedente.negozi || Object.keys(precedente.perNegozio || {}).length) : 0;
if (precedente && precedente.legati > 0) {
  /* due segnali di allarme, e basta uno solo:
     - mancano negozi rispetto al giro buono (file rovinato o non scaricato)
     - si legano molti meno ingredienti (catalogo a metà) */
  if (negoziPrima && negoziOra < negoziPrima) {
    console.log(`Trovati ${negoziOra} negozi invece di ${negoziPrima}: manca qualcosa, `
      + `tengo il file buono e non scrivo nulla.`);
    process.exit(0);
  }
  if (rapporto.legati < precedente.legati * 0.9) {
    console.log(`Il giro nuovo lega ${rapporto.legati} ingredienti contro i ${precedente.legati} del file esistente: `
      + `troppo pochi, tengo il file buono e non scrivo nulla.`);
    process.exit(0);
  }
}
const copertura = Math.round(rapporto.legati / ingredienti.length * 100);
console.log(`Legati a prodotti veri: ${rapporto.legati} su ${ingredienti.length} (${copertura}%)`);
console.log("Per negozio:", Object.entries(rapporto.perNegozio).sort((a, b) => b[1] - a[1]).map(([n, v]) => `${n} ${v}`).join(", "));
if (rapporto.senza.length) console.log(`Senza corrispondenza (${rapporto.senza.length}): ${rapporto.senza.slice(0, 18).join(", ")}${rapporto.senza.length > 18 ? "…" : ""}`);

fs.writeFileSync(OUT, JSON.stringify({
  versione: 1, data: new Date().toISOString().slice(0, 10),
  ingredienti: ingredienti.length, legati: rapporto.legati, copertura,
  negozi: Object.keys(negozi).length,
  senza: rapporto.senza, voci: out,
}));
console.log(`Scritto ${OUT}: ${(fs.statSync(OUT).size / 1024).toFixed(0)} kB`);
