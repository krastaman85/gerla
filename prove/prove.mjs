/**
 * Prove di Gerla — girano su ogni modifica, senza browser.
 * Non provano l'aspetto: provano che i conti tornino e che i dati siano sani.
 */
import fs from "node:fs";
import { JSDOM } from "jsdom";

const html = fs.readFileSync("gerla.html", "utf8");
let falliti = 0, passati = 0;
const prova = (nome, cond, dettaglio = "") => {
  if (cond) { passati++; console.log(`  ok   ${nome}`); }
  else { falliti++; console.log(`  NO   ${nome}${dettaglio ? " — " + dettaglio : ""}`); }
};

console.log("Struttura del file");
prova("un solo file, sotto il mezzo mega", html.length < 700000, `${(html.length/1024|0)} kB`);
prova("nessun negozio duplicato",
  (() => { const id = [...html.matchAll(/\{id:"([a-z]+)",\s*n:"[^"]+",\s*z:"(CH|IT)"/g)].map(m => m[1]);
    return new Set(id).size === id.length; })());
prova("nessun testo di prova dimenticato", !/lorem ipsum|TODO|FIXME/i.test(html));

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true });
const w = dom.window;
await new Promise(r => setTimeout(r, 1500));
const g = e => w.eval(e);

console.log("\nDati");
prova("almeno 600 prodotti", g("Object.keys(PROD).length") >= 600, g("Object.keys(PROD).length") + "");
prova("almeno 170 piatti", g("PIATTI.length") >= 170, g("PIATTI.length") + "");
prova("nessun ingrediente orfano", g("[...PIATTI,...COLAZIONI,...MERENDE].every(p=>p.ing.every(([i])=>PROD[i]))"));
prova("nessuna portata orfana", g("PORTATE.every(p=>p.ing.every(([i])=>PROD[i]))"));
prova("menu della casa completi", g("MENU_EVENTO.every(m=>m.portate.every(p=>p.ing.every(([i])=>PROD[i])))"));

console.log("\nGeneratore di menu");
g("S.giorni=28; genera(false)");
prova("28 giorni generati", g("S.menu.length") === 28);
prova("nessun piatto ripetuto più di due volte",
  g("Math.max(...Object.values(S.menu.flatMap(x=>[x.pranzo.id,x.cena.id]).reduce((a,k)=>{a[k]=(a[k]||0)+1;return a},{})))") <= 2);
prova("pranzo e cena mai sullo stesso ingrediente perno",
  g("S.menu.filter(x=>perno(x.pranzo)===perno(x.cena)).length") === 0);
prova("energia in un intervallo sensato",
  (() => { const k = g("Math.round(S.menu.reduce((a,x)=>a+['colazione','pranzo','merenda','cena'].reduce((b,c)=>b+kcalPiatto(x[c]),0),0)/S.menu.length)");
    return k > 1200 && k < 3200; })(), g("Math.round(S.menu.reduce((a,x)=>a+['colazione','pranzo','merenda','cena'].reduce((b,c)=>b+kcalPiatto(x[c]),0),0)/S.menu.length)") + " kcal");

console.log("\nDiete");
g("S.prefs=new Set(['vegano']); genera(false)");
prova("vegano: nessun ingrediente animale",
  g("S.menu.every(x=>['colazione','pranzo','merenda','cena'].every(k=>x[k].ing.every(([i])=>!animale(i))))"));
g("S.prefs=new Set(['vegetariano']); genera(false)");
prova("vegetariano: niente carne né pesce",
  g("S.menu.every(x=>['colazione','pranzo','merenda','cena'].every(k=>x[k].ing.every(([i])=>vegetariano(i))))"));
g("S.prefs=new Set(); genera(false)");

console.log("\nPrezzi e lista");
prova("la lista non è vuota", g("costruisciLista().length") > 20);
prova("il totale è un numero sensato", (() => { const t = g("totale(costruisciLista())"); return t > 50 && t < 5000; })());
prova("ogni riga ha un negozio acceso", g("costruisciLista().every(r=>S.riv.has(r.riv.id))"));
prova("le quantità sono positive", g("costruisciLista().every(r=>r.q>0)"));

console.log("\nLingue");
prova("quattro lingue", g("LINGUE.length") === 4);
prova("dizionari allineati",
  g("Object.keys(DIZ.en).length") > 380 && g("Object.keys(DIZ.fr).length") > 380 && g("Object.keys(DIZ.de).length") > 380,
  `${g("Object.keys(DIZ.en).length")}/${g("Object.keys(DIZ.fr).length")}/${g("Object.keys(DIZ.de).length")}`);

console.log(`\n${passati} passate, ${falliti} fallite`);
process.exit(falliti ? 1 : 0);
