/**
 * Verifica di coerenza — controlla che tutto ciò che si tiene insieme torni:
 * ingredienti che esistono, quantità sensate, unità coerenti, allergeni
 * dichiarati, stagionalità plausibile, prezzi credibili, nomi non duplicati.
 * Non prova che l'app funzioni: prova che i dati non si contraddicano.
 */
import fs from "node:fs";
import { JSDOM } from "jsdom";

const dom = new JSDOM(fs.readFileSync("gerla.html", "utf8"), { runScripts: "dangerously", pretendToBeVisual: true });
const w = dom.window;
await new Promise(r => setTimeout(r, 2000));
const g = e => w.eval(e);

const problemi = [];
const nota = (gruppo, testo) => problemi.push({ gruppo, testo });

/* ---------- 1. ogni ingrediente citato esiste ---------- */
const orfani = g(`JSON.stringify([...PIATTI,...COLAZIONI,...MERENDE,...PORTATE]
  .flatMap(p=>p.ing.filter(([i])=>!PROD[i]).map(([i])=>p.id+" → "+i)))`);
JSON.parse(orfani).forEach(o => nota("ingredienti inesistenti", o));

const orfaniMenu = g(`JSON.stringify(MENU_EVENTO.flatMap(m=>m.portate.flatMap(p=>
  p.ing.filter(([i])=>!PROD[i]).map(([i])=>m.id+"/"+p.n+" → "+i))))`);
JSON.parse(orfaniMenu).forEach(o => nota("ingredienti inesistenti", o));

/* ---------- 2. quantità plausibili per porzione ---------- */
const quantita = JSON.parse(g(`JSON.stringify([...PIATTI,...COLAZIONI,...MERENDE].flatMap(p=>
  p.ing.map(([i,q])=>({piatto:p.id,ing:i,q,um:PROD[i]?PROD[i].um:"?",cat:PROD[i]?PROD[i].cat:"?"}))))`));
for (const x of quantita) {
  if (!(x.q > 0)) { nota("quantità", `${x.piatto}: ${x.ing} = ${x.q}`); continue; }
  if (x.um === "g" && x.q > 500 && !["Verdura","Frutta"].includes(x.cat)) nota("quantità", `${x.piatto}: ${x.q} g di ${x.ing} a porzione`);
  if (x.um === "g" && x.q > 900) nota("quantità", `${x.piatto}: ${x.q} g di ${x.ing} a porzione`);
  if (x.um === "ml" && x.q > 700) nota("quantità", `${x.piatto}: ${x.q} ml di ${x.ing} a porzione`);
  if (x.um === "pz" && x.q > 6) nota("quantità", `${x.piatto}: ${x.q} pezzi di ${x.ing} a porzione`);
}

/* ---------- 3. gli allergeni del piatto contengono quelli degli ingredienti ---------- */
const allerg = JSON.parse(g(`JSON.stringify(PIATTI.map(p=>{
  const dagliIng=new Set();
  p.ing.forEach(([i])=>{ const a=PROD[i]&&PROD[i].al; if(a) a.split(",").map(x=>x.trim()).filter(Boolean).forEach(x=>dagliIng.add(x)); });
  const dichiarati=new Set(p.t);
  const mappa={"glutine":"glutine","lattosio":"lattosio","uova":"uova","frutta a guscio":"noci","noci":"noci",
               "soia":"soia","sesamo":"sesamo","pesce":"pesce","crostacei":"crostacei","molluschi":"molluschi","solfiti":"solfiti"};
  const mancanti=[...dagliIng].map(a=>mappa[a]||a).filter(a=>a&&!dichiarati.has(a));
  return mancanti.length?{id:p.id,n:p.n,mancanti:[...new Set(mancanti)]}:null;}).filter(Boolean))`));
allerg.forEach(a => nota("allergeni non dichiarati", `${a.n}: manca ${a.mancanti.join(", ")}`));

/* ---------- 4. diete coerenti con gli ingredienti ---------- */
const dieteSbagliate = JSON.parse(g(`JSON.stringify(PIATTI.filter(p=>
  p.t.includes("vegano") && p.ing.some(([i])=>animale(i))).map(p=>p.n))`));
dieteSbagliate.forEach(n => nota("diete", `dichiarato vegano ma contiene ingredienti animali: ${n}`));
const vegSbagliati = JSON.parse(g(`JSON.stringify(PIATTI.filter(p=>
  p.t.includes("veg") && !p.t.includes("vegano") && p.ing.some(([i])=>!vegetariano(i))).map(p=>p.n))`));
vegSbagliati.forEach(n => nota("diete", `dichiarato vegetariano ma contiene carne o pesce: ${n}`));

/* ---------- 5. nomi duplicati ---------- */
for (const [lista, etichetta] of [["PROD","prodotti"],["PIATTI","piatti"]]) {
  const dup = JSON.parse(g(`(()=>{const v=${lista==="PROD"?"Object.values(PROD)":lista}.map(x=>x.n||x.nome);
    const c={}; v.forEach(n=>c[n]=(c[n]||0)+1);
    return JSON.stringify(Object.entries(c).filter(([,k])=>k>1).map(([n,k])=>n+" ×"+k));})()`));
  dup.forEach(d => nota("nomi doppi", `${etichetta}: ${d}`));
}
/* gli identificativi devono essere unici dentro la loro lista, non fra liste
   diverse: una colazione e una portata possono chiamarsi entrambe c1 senza
   che si pestino i piedi. Confonderle produceva diciassette falsi allarmi. */
for (const lista of ["PIATTI", "COLAZIONI", "MERENDE", "PORTATE"]) {
  const dup = JSON.parse(g(`(()=>{const v=${lista}.map(x=>x.id); const c={};
    v.forEach(n=>c[n]=(c[n]||0)+1);
    return JSON.stringify(Object.entries(c).filter(([,k])=>k>1).map(([n,k])=>n+" ×"+k));})()`));
  dup.forEach(d => nota("identificativi doppi", `${lista}: ${d}`));
}

/* ---------- 6. prezzi e formati credibili ---------- */
const prezzi = JSON.parse(g(`JSON.stringify(Object.values(PROD).map(p=>({id:p.id,n:p.n,p:p.p,pu:p.pu,um:p.um,cat:p.cat})))`));
for (const p of prezzi) {
  if (!(p.p > 0)) nota("prezzi", `${p.n}: prezzo ${p.p}`);
  if (!(p.pu > 0)) nota("formati", `${p.n}: formato ${p.pu} ${p.um}`);
  /* spezie, tartufo e funghi secchi costano davvero centinaia al chilo:
     segnalarli era un falso allarme, e i falsi allarmi insegnano a ignorare
     il controllo. La soglia alta vale solo per ciò che si compra a peso. */
  const prezioso = /tartuf|vanigli|zafferan|porcini secchi|spezie|origano|cannella|curcuma|pepe|curry|paprika|noce moscata/i.test(p.n);
  if (p.um === "g" && p.pu > 0) { const alKg = p.p / p.pu * 1000;
    if (alKg > (prezioso ? 4000 : 200)) nota("prezzi", `${p.n}: CHF ${alKg.toFixed(0)} al chilo`);
    if (alKg < 0.4) nota("prezzi", `${p.n}: CHF ${alKg.toFixed(2)} al chilo`); }
  if (p.um === "ml" && p.pu > 0) { const alL = p.p / p.pu * 1000;
    if (alL > 120) nota("prezzi", `${p.n}: CHF ${alL.toFixed(0)} al litro`); }
}

/* ---------- 7. stagionalità sensata ---------- */
const stag = JSON.parse(g(`JSON.stringify([...PIATTI,...Object.values(PROD)].filter(x=>x.sea)
  .map(x=>({n:x.n,sea:x.sea})))`));
stag.forEach(x => { const [a,b]=x.sea;
  if (!(a>=1&&a<=12&&b>=1&&b<=12)) nota("stagionalità", `${x.n}: mesi ${a}–${b}`); });

/* ---------- 8. energia e nutrienti coerenti ---------- */
const energia = JSON.parse(g(`JSON.stringify(PIATTI.map(p=>({n:p.n,k:Math.round(kcalPiatto(p)),pr:Math.round(protPiatto(p))})))`));
energia.forEach(e => {
  if (e.k < 90 && !/insalata|brodo|tisana/i.test(e.n)) nota("energia", `${e.n}: ${e.k} kcal a porzione`);
  if (e.k > 1200) nota("energia", `${e.n}: ${e.k} kcal a porzione`);
  if (e.pr > 110) nota("nutrienti", `${e.n}: ${e.pr} g di proteine a porzione`);
});

/* ---------- 9. i menu delle occasioni sono completi ---------- */
const menuIncompleti = JSON.parse(g(`JSON.stringify(MENU_EVENTO.filter(m=>!m.portate||m.portate.length<3)
  .map(m=>m.n+" ("+(m.portate?m.portate.length:0)+" portate)"))`));
menuIncompleti.forEach(m => nota("menu incompleti", m));

/* ---------- 10. ogni cucina ha abbastanza portate ---------- */
const cucineVuote = JSON.parse(g(`JSON.stringify(CUCINE.map(c=>({n:c.n,q:PORTATE.filter(p=>p.cuc===c.id).length}))
  .filter(x=>x.q<4).map(x=>x.n+": "+x.q+" portate"))`));
cucineVuote.forEach(c => nota("cucine con poche portate", c));

/* ---------- rapporto ---------- */
const gruppi = {};
problemi.forEach(p => (gruppi[p.gruppo] = gruppi[p.gruppo] || []).push(p.testo));
console.log(`Controllati: ${g("Object.keys(PROD).length")} prodotti, ${g("PIATTI.length")} piatti, `
  + `${g("PORTATE.length")} portate, ${g("MENU_EVENTO.length")} menu, ${g("CUCINE.length")} cucine.\n`);
if (!problemi.length) console.log("Nessuna incoerenza trovata.");
for (const [nome, elenco] of Object.entries(gruppi)) {
  console.log(`${nome.toUpperCase()} — ${elenco.length}`);
  elenco.slice(0, 12).forEach(e => console.log("   · " + e));
  if (elenco.length > 12) console.log(`   … e altri ${elenco.length - 12}`);
  console.log();
}
process.exit(0);
