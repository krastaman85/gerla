#!/usr/bin/env node
/**
 * Gerla — sincronizzazione del catalogo esteso
 * --------------------------------------------
 *   node gerla-catalogo.mjs [--promozioni] [--indice] [--negozi migros,coop] [--max 6000]
 *
 * Produce due cose, tenute separate perché hanno ritmi diversi:
 *
 *   gerla-promozioni.json   ~3500 offerte in corso, con inizio e fine reali.
 *                           Leggero (poche centinaia di kB), cambia ogni settimana:
 *                           si rigenera tutti i giorni.
 *
 *   catalogo/<negozio>.json indice compatto dei prodotti di ogni negozio
 *                           (nome, marca, formato, prezzo, prezzo al chilo,
 *                           Nutri-Score, categoria). Si rigenera una volta a
 *                           settimana: i cataloghi non cambiano ogni giorno.
 *
 * L'app non carica mai tutto: prende le promozioni all'avvio, e le schegge del
 * catalogo solo quando cerchi qualcosa che non è nel listino di casa.
 *
 * Perché non si scarica tutto in un file solo: nove negozi fanno oltre centomila
 * prodotti, circa 250 MB di JSON grezzo. Nessun browser lo apre e nessuno vuole
 * scaricarlo. L'indice compatto tiene solo i campi che servono e pesa ~40 volte meno.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://uofukvfsak.execute-api.eu-central-1.amazonaws.com/prod";
const UA = "Gerla/1.0 (pianificatore spesa personale; uso non commerciale)";
const NEGOZI = ["migros", "coop", "aldi", "lidl", "denner", "ottos", "prodega", "aligro", "topcc"];

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ha = k => process.argv.includes(k);
const pausa = ms => new Promise(r => setTimeout(r, ms));
const oggi = new Date().toISOString().slice(0, 10);

async function chiedi(url, tentativi = 3) {
  for (let i = 1; i <= tentativi; i++) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 30000);
      try {
        const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": UA, Accept: "application/json" } });
        if (r.status === 429 || r.status >= 500) throw new Error("HTTP " + r.status);
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
      } finally { clearTimeout(t); }
    } catch (e) {
      if (i === tentativi) throw e;
      await pausa(1500 * i);          // se il servizio è in affanno, rallento
    }
  }
}

/* ---------------------------------------------------------
   1. PROMOZIONI — leggere, preziose, cambiano ogni settimana
   --------------------------------------------------------- */
async function promozioni() {
  /* stessa regola per le offerte: se un negozio non risponde, tengo le sue
     ultime offerte valide invece di lasciare la scheda vuota */
  let vecchie = {};
  try { vecchie = JSON.parse(fs.readFileSync("gerla-promozioni.json", "utf8")).negozi || {}; } catch (e) {}
  const out = {};
  let totale = 0, ripresi = 0;
  for (const neg of NEGOZI) {
    try {
      const j = await chiedi(`${BASE}/promotions?store=${neg}&limit=1000`);
      const lista = (j.products || []).filter(p => p.sale_price > 0 && p.current_best_price > 0);
      out[neg] = lista.map(p => ({
        id: p.product_id, n: p.product_name, m: p.brand || "",
        f: p.package_size || "", p: p.current_best_price, pieno: p.was_price || p.sale_price,
        sc: p.discount_percent ? Math.round(p.discount_percent) : null,
        pu: p.price_per_unit || null, pul: p.price_per_unit_label || "",
        da: p.promotion_start || null, a: p.promotion_end || null,
        c1: p.category_l1 || "", c2: p.category_l2 || "",
        cibo: p.is_food !== false, carta: !!p.requires_loyalty_card,
      }));
      totale += out[neg].length;
      console.log(`  ${neg.padEnd(9)} ${out[neg].length} promozioni`);
    } catch (e) {
      const oggi2 = new Date().toISOString().slice(0, 10);
      const salvate = (vecchie[neg] || []).filter(p => !p.a || p.a >= oggi2);
      out[neg] = salvate;
      ripresi += salvate.length;
      console.log(`  ${neg.padEnd(9)} non risponde (${e.message}) — tengo ${salvate.length} offerte ancora valide`);
    }
    await pausa(400);
  }
  /* il totale è quello che c'è davvero nel file, comprese le offerte riprese:
     contare solo quelle appena scaricate faceva dire "0 offerte" a un file
     che ne conteneva più di duemila */
  totale = Object.values(out).reduce((a, v) => a + v.length, 0);
  const scade = {};
  Object.values(out).flat().forEach(p => { if (p.a) scade[p.a] = (scade[p.a] || 0) + 1; });
  console.log(`Promozioni raccolte: ${totale}${ripresi ? `, di cui ${ripresi} riprese dal giro precedente` : ""}`);
  return { versione: 1, data: oggi, generato: new Date().toISOString(), totale, scadenze: scade, negozi: out };
}

/* ---------------------------------------------------------
   2. INDICE DEI PRODOTTI — pesante, cambia poco
   --------------------------------------------------------- */
/* le categorie di primo livello: la scorsa per negozio si ferma a poche
   migliaia di articoli, ma ripassando categoria per categoria ne escono
   molti di più. Chi non compare in nessuna delle due vie non esiste. */
const CATEGORIE_L1 = ["dairy_eggs","bread_bakery","pantry","frozen","snacks_sweets","household",
  "meat_fish","fruits_vegetables","drinks","beverages","fresh","baby","beauty","pets","world"];

async function indiceNegozio(neg, max) {
  const visti = new Map();
  let cursore = null, pagine = 0;
  const t0 = Date.now();
  const raccogli = prodotti => {
    for (const p of prodotti) {
      if (visti.has(p.product_id)) continue;
      visti.set(p.product_id, [
        p.product_name || "", p.brand || "", p.package_size || "",
        p.current_best_price ?? null, p.price_per_unit ?? null,
        (p.price_per_unit_label || "").replace("CHF/", ""),
        p.nutriscore_grade || "", p.category_l2 || "", p.is_on_promotion ? 1 : 0,
      ]);
    }
  };
  while (visti.size < max) {
    const u = `${BASE}/products?store=${neg}&limit=200` + (cursore ? `&cursor=${encodeURIComponent(cursore)}` : "");
    let j;
    try { j = await chiedi(u); } catch (e) { console.log(`  ${neg}: interrotto a ${visti.size} (${e.message})`); break; }
    const prodotti = j.products || [];
    if (!prodotti.length) break;
    raccogli(prodotti);
    pagine++;
    if (!j.has_more || !j.next_cursor || j.next_cursor === cursore) break;
    cursore = j.next_cursor;
    await pausa(180);
  }
  /* seconda passata: categoria per categoria, per prendere ciò che la
     scorsa lineare non raggiunge */
  for (const c of CATEGORIE_L1) {
    if (visti.size >= max) break;
    let cur = null, giri = 0;
    while (giri < 40 && visti.size < max) {
      const u = `${BASE}/products?store=${neg}&category=${c}&limit=500` + (cur ? `&cursor=${encodeURIComponent(cur)}` : "");
      let j;
      try { j = await chiedi(u); } catch (e) { break; }
      const pr = j.products || [];
      if (!pr.length) break;
      const prima = visti.size;
      raccogli(pr);
      pagine++; giri++;
      if (!j.has_more || !j.next_cursor || j.next_cursor === cur) break;
      if (visti.size === prima && giri > 2) break;      // non sta più aggiungendo nulla
      cur = j.next_cursor;
      await pausa(160);
    }
    await pausa(200);
  }
  const secondi = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`  ${neg.padEnd(9)} ${visti.size} prodotti in ${pagine} pagine, ${secondi}s`);
  return {
    versione: 1, negozio: neg, data: oggi, prodotti: visti.size,
    campi: ["nome", "marca", "formato", "prezzo", "prezzo_unita", "unita", "nutri", "categoria", "azione"],
    voci: Object.fromEntries(visti),
  };
}

/* --------------------------------------------------------- */
async function main() {
  const soloPromo = ha("--promozioni") && !ha("--indice");
  const soloIndice = ha("--indice") && !ha("--promozioni");
  const negozi = (arg("--negozi", "") || "").split(",").filter(Boolean);
  const max = +arg("--max", 6000);

  if (!soloIndice) {
    console.log("Promozioni in corso:");
    const p = await promozioni();
    fs.writeFileSync("gerla-promozioni.json", JSON.stringify(p));
    const kb = (fs.statSync("gerla-promozioni.json").size / 1024).toFixed(0);
    console.log(`Scritto gerla-promozioni.json — ${p.totale} offerte, ${kb} kB\n`);
  }

  if (!soloPromo) {
    console.log(`Indice prodotti (massimo ${max} per negozio):`);
    fs.mkdirSync("catalogo", { recursive: true });
    const riepilogo = { versione: 1, data: oggi, negozi: {} };
    for (const neg of (negozi.length ? negozi : NEGOZI)) {
      const idx = await indiceNegozio(neg, max);
      const file = path.join("catalogo", `${neg}.json`);
      fs.writeFileSync(file, JSON.stringify(idx));
      riepilogo.negozi[neg] = { prodotti: idx.prodotti, kb: Math.round(fs.statSync(file).size / 1024) };
      await pausa(600);
    }
    fs.writeFileSync(path.join("catalogo", "indice.json"), JSON.stringify(riepilogo, null, 1));
    const tot = Object.values(riepilogo.negozi).reduce((a, x) => a + x.prodotti, 0);
    const peso = Object.values(riepilogo.negozi).reduce((a, x) => a + x.kb, 0);
    console.log(`\nCatalogo: ${tot} prodotti, ${(peso / 1024).toFixed(1)} MB in ${Object.keys(riepilogo.negozi).length} file.`);
  }
}

main().catch(e => { console.error("Errore:", e); process.exit(1); });
