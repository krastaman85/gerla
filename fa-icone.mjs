/**
 * Le icone si disegnano con lo stesso marchio dell'app, letto da gerla.html.
 * Prima erano un disegno a parte, semplificato e senza bretelle: due marchi
 * diversi per la stessa cosa, e nessuno se ne accorgeva finché non si vedevano
 * accanto. Qui il marchio è uno solo, e resta allineato per forza.
 */
import fs from "node:fs";
import puppeteer from "puppeteer";

const html = fs.readFileSync("gerla.html", "utf8");
const i = html.indexOf('<symbol id="logo-gerla"');
const marchio = html.slice(html.indexOf(">", i) + 1, html.indexOf("</symbol>", i));

/* il disegno vive in un riquadro 64×64 e occupa da 12,5 a 51,5 in larghezza
   e da 24 a 54 in altezza, bretelle comprese: lo centro su quel rettangolo */
/* il disegno occupa da 14,5 a 49,5 in larghezza e da 16,5 a 52 in altezza,
   bretelle comprese: centro su quel rettangolo, non sul riquadro vuoto */
const CONT = { x: 14.5, y: 16.5, w: 35, h: 35.5 };

function icona(lato, quota) {
  const scala = (lato * quota) / Math.max(CONT.w, CONT.h);
  const dx = lato / 2 - (CONT.x + CONT.w / 2) * scala;
  const dy = lato / 2 - (CONT.y + CONT.h / 2) * scala;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lato}" height="${lato}" viewBox="0 0 ${lato} ${lato}">
    <rect width="${lato}" height="${lato}" fill="#060a13"/>
    <g transform="translate(${dx.toFixed(2)},${dy.toFixed(2)}) scale(${scala.toFixed(4)})">${marchio}</g>
  </svg>`;
}

const b = await puppeteer.launch({ args: ["--no-sandbox"] });
/* quota = quanto del lato occupa il marchio.
   Normale 0.80: piena e centrata. Adattiva 0.58: il sistema ritaglia fino al
   20% per lato, e con una quota alta le bretelle verrebbero tagliate via. */
for (const [lato, quota, nome] of [
  [192, 0.80, "icona-192.png"],
  [512, 0.80, "icona-512.png"],
  [512, 0.58, "icona-maskable.png"],
  [180, 0.80, "icona-apple.png"],
]) {
  const pg = await b.newPage();
  await pg.setViewport({ width: lato, height: lato });
  await pg.setContent("<style>html,body{margin:0;background:#060a13}</style>" + icona(lato, quota));
  await pg.screenshot({ path: nome });
  await pg.close();
  console.log(`  ${nome} — marchio al ${Math.round(quota * 100)}% del lato`);
}
await b.close();
