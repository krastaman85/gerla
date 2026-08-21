/* =========================================================
   SKRIMPERS — interfaccia dati svizzera
   ---------------------------------------------------------
   Fornisce prezzi per singolo negozio (Migros, Coop, Aldi, Lidl, Denner,
   Otto's, Prodega, Aligro, TopCC), promozioni in corso, Nutri-Score
   ufficiale e prezzi dei carburanti alla pompa.

   NOTA IMPORTANTE. È un'interfaccia pubblica ma non documentata di un
   servizio terzo: non c'è una licenza d'uso dichiarata. Qui viene
   interrogata con parsimonia (poche decine di richieste al giorno, una
   pausa fra l'una e l'altra, con un'intestazione che dice chi siamo).
   Prima di usarla in qualcosa di pubblico va chiesto il permesso a loro.
   Se un giorno smette di rispondere, lo script prosegue con le altre fonti.
   ========================================================= */

export const SK_BASE = "https://uofukvfsak.execute-api.eu-central-1.amazonaws.com/prod";

/* i loro negozi e i nostri */
export const SK_NEGOZI = {
  migros: "migros", coop: "coop", aldi: "aldi", lidl: "lidlch", denner: "denner",
  ottos: "ottos", prodega: "prodega", aligro: "aligro", topcc: "topcc", manor: "manor",
};

/* la loro ricerca capisce tedesco e inglese: qui i termini per i nostri prodotti.
   Dove manca la voce si usa il nome italiano, che per molti prodotti funziona
   comunque (mozzarella, zucchine, risotto, prosciutto…). */
export const SK_TERMINI = {
  pasta:"Teigwaren", pastaint:"Vollkorn Teigwaren", riso:"Reis", basmati:"Basmati Reis",
  risointegrale:"Vollkornreis", carnaroli:"Risottoreis", polenta:"Polenta", farina:"Mehl",
  farinaint:"Vollkornmehl", farina00:"Weissmehl", pane:"Brot", paneint:"Vollkornbrot",
  paneseg:"Roggenbrot", baguette:"Baguette", panecarre:"Toastbrot", pangrattato:"Paniermehl",
  gnocchi:"Gnocchi", couscous:"Couscous", quinoa:"Quinoa", farro:"Dinkel", orzo:"Gerste",
  latte:"Vollmilch", lattesenzalatt:"laktosefreie Milch", lattavena:"Hafermilch",
  lattemandorla:"Mandelmilch", latteveg:"Sojadrink", panna:"Rahm", pannamontare:"Vollrahm",
  burro:"Butter", burroghee:"Butterschmalz", yogurtnat:"Naturjoghurt", yogurtfru:"Fruchtjoghurt",
  yogurtgreco:"griechischer Joghurt", skyr:"Skyr", quark:"Quark", kefir:"Kefir",
  mozzarella:"Mozzarella", bufala:"Büffelmozzarella", ricotta:"Ricotta", mascarpone:"Mascarpone",
  parmigiano:"Parmesan", grattugiato:"geriebener Käse", semiduro:"Halbhartkäse",
  emmental:"Emmentaler", gruyere:"Gruyère", raclette:"Raclette Käse", fonduta:"Fondue",
  gorgonzola:"Gorgonzola", brie:"Brie", feta:"Feta", formaggino:"Frischkäse",
  uova:"Eier", uova_bio:"Bio Eier",
  pettopollo:"Pouletbrust", cosciapollo:"Pouletschenkel", pollo_intero:"Poulet ganz",
  tacchino:"Truten", macinato:"Hackfleisch", macinatopollo:"Poulet Hackfleisch",
  spezzatino:"Rindsvoressen", entrecote:"Entrecôte", filettomanzo:"Rindsfilet",
  arrostovitello:"Kalbsbraten", ossobuco:"Ossobuco", fettine:"Kalbsschnitzel",
  luganighetta:"Luganighe", salsicciagr:"Bratwurst", wurstel:"Wienerli",
  prosccotto:"Cocktailschinken", proscrudo:"Rohschinken", salame:"Salami", speck:"Speck",
  pancetta:"Speckwürfel", bresaola:"Bündnerfleisch", mortadella:"Mortadella",
  salmone:"Lachsfilet", salmoneaff:"Räucherlachs", merluzzo:"Kabeljau", platessa:"Eglifilet",
  tonno:"Thon", gamberi:"Crevetten", cozze:"Muscheln", trota:"Forelle", branzino:"Wolfsbarsch",
  bastoncini:"Fischstäbchen", sardine:"Sardinen", acciughe:"Sardellen",
  patate:"Kartoffeln", carote:"Karotten", cipolle:"Zwiebeln", aglio:"Knoblauch",
  zucchine:"Zucchetti", melanzane:"Auberginen", pomodori:"Tomaten", pomodorini:"Cherrytomaten",
  peperoni:"Peperoni", insalata:"Kopfsalat", misticanza:"Salatmischung", spinaci:"Spinat",
  broccoli:"Broccoli", cavolfiore:"Blumenkohl", verza:"Wirz", zucca:"Kürbis",
  finocchi:"Fenchel", porri:"Lauch", sedano:"Sellerie", funghi:"Champignons",
  fagiolini:"Bohnen", piselli:"Erbsen", minestrone:"Gemüsemischung", cetrioli:"Gurken",
  cappuccio:"Weisskohl", radicchio:"Radicchio", asparagi:"Spargeln", cicoria:"Cicorino",
  mele:"Äpfel", banane:"Bananen", arance:"Orangen", mandarini:"Mandarinen", pere:"Birnen",
  pesche:"Pfirsiche", albicocche:"Aprikosen", fragole:"Erdbeeren", uva:"Trauben",
  kiwi:"Kiwi", melone:"Melone", anguria:"Wassermelone", limoni:"Zitronen", lime:"Limetten",
  fruttibosco:"Beeren", mirtilli:"Heidelbeeren", ananas:"Ananas", avocado:"Avocado",
  castagne:"Marroni",
  lenticchie:"Linsen", lenticchierosse:"rote Linsen", ceci:"Kichererbsen",
  fagioli:"Bohnen Konserve", fagiolineri:"schwarze Bohnen", tofu:"Tofu", tempeh:"Tempeh",
  seitan:"Seitan", hummus:"Hummus", edamame:"Edamame",
  olio:"Olivenöl", oliosem:"Sonnenblumenöl", aceto:"Essig", balsamico:"Balsamico",
  sale:"Salz", zucchero:"Zucker", zuccherocanna:"Rohrzucker", passata:"Passata",
  pelati:"geschälte Tomaten", pesto:"Pesto", maionese:"Mayonnaise", senape:"Senf",
  ketchup:"Ketchup", dado:"Bouillon", brodoveg:"Gemüsebouillon", spezie:"Gewürze",
  origanosecco:"Oregano", curry:"Curry", paprika:"Paprika", cannella:"Zimt",
  marmellata:"Konfitüre", miele:"Honig", cremacacao:"Nussaufstrich", cioccolato:"Schokolade",
  fondente:"dunkle Schokolade", biscotti:"Guetzli", fettebis:"Zwieback",
  cornflakes:"Cornflakes", muesli:"Müesli", avena:"Haferflocken", gallette:"Reiswaffeln",
  caffe:"Kaffee gemahlen", capsule:"Kaffeekapseln", te:"Tee", cacao:"Kakao",
  succo:"Orangensaft", succomela:"Apfelsaft", acqua:"Mineralwasser", acquagas:"Mineralwasser mit Kohlensäure",
  bibite:"Süssgetränke", birra:"Bier", vinobianco:"Weisswein", vinorosso:"Rotwein",
  prosecco:"Prosecco", merlot:"Merlot Ticino", gazosa:"Gazosa",
  noci:"Baumnüsse", mandorle:"Mandeln", pinoli:"Pinienkerne", uvetta:"Sultaninen",
  detbucato:"Waschmittel", ammorbid:"Weichspüler", detpiatti:"Handgeschirrspülmittel",
  pastiglielav:"Geschirrspültabs", sgrassatore:"Reinigungsmittel", cartaig:"WC-Papier",
  cartacucina:"Haushaltpapier", sacchetti:"Abfallsäcke", spugne:"Schwämme",
  saponemani:"Handseife", shampoo:"Shampoo", bagnoschiuma:"Duschmittel",
  dentifricio:"Zahnpasta", spazzolino:"Zahnbürste", deodorante:"Deo", rasoi:"Rasierer",
  fazzoletti:"Taschentücher", pannolini:"Windeln", solare:"Sonnencreme",
};

const pausaSk = ms => new Promise(r => setTimeout(r, ms));

async function chiedi(url, ua) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), 20000);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { "User-Agent": ua, Accept: "application/json" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

/* ---------- prezzi, promozioni e Nutri-Score ---------- */
export async function skPrezzi(catalogo, ua, limite = 90, log = console.log) {
  const prezziRiv = {}, promo = {}, nutri = {}, base = {};
  const daFare = catalogo.filter(p => SK_TERMINI[p.id]).slice(0, limite || undefined);
  let ok = 0, falliti = 0;

  for (const p of daFare) {
    const q = SK_TERMINI[p.id] || p.nome;
    let j;
    try { j = await chiedi(`${SK_BASE}/products?q=${encodeURIComponent(q)}`, ua); }
    catch (e) { falliti++; await pausaSk(1200); continue; }
    const trovati = (j.products || []).filter(x => x.is_available !== false && x.current_best_price > 0);
    if (!trovati.length) { await pausaSk(500); continue; }

    /* il prezzo va riportato al nostro formato: uso il prezzo per unità
       quando c'è (CHF/kg, CHF/L), altrimenti confronto le confezioni */
    const perNostroFormato = x => {
      const etichetta = (x.price_per_unit_label || "").toUpperCase();
      const pu = x.price_per_unit;
      // il prezzo al chilo o al litro è l'unico modo pulito di confrontare
      // confezioni diverse: senza quello non mi fido e scarto il risultato
      if (pu > 0 && p.um === "g"  && /KG|100\s?G/.test(etichetta))
        return etichetta.includes("KG") ? pu * p.pu / 1000 : pu * p.pu / 100;
      if (pu > 0 && p.um === "ml" && /\bL\b|100\s?ML/.test(etichetta))
        return /\bL\b/.test(etichetta) ? pu * p.pu / 1000 : pu * p.pu / 100;
      if (p.um === "pz") {
        const q2 = x.sk_package_quantity || 0;
        if (!(q2 > 0)) return null;
        // accetto solo confezioni confrontabili con la nostra
        if (q2 < p.pu / 4 || q2 > p.pu * 4) return null;
        return x.current_best_price / q2 * p.pu;
      }
      return null;
    };

    const perNegozio = {};
    for (const x of trovati) {
      const nostro = SK_NEGOZI[x.store];
      if (!nostro) continue;
      const v = perNostroFormato(x);
      if (!(v > 0) || v > p.p * 2.6 || v < p.p * 0.3) continue;     // scarto gli abbinamenti assurdi
      (perNegozio[nostro] = perNegozio[nostro] || []).push({ v, x });
    }

    const righe = {}, dettaglio = {};
    for (const [neg, arr] of Object.entries(perNegozio)) {
      arr.sort((a, b) => a.v - b.v);
      const mediano = arr[Math.floor(arr.length / 2)];
      righe[neg] = Math.round(mediano.v * 20) / 20;
      dettaglio[neg] = { n: arr.length, esempio: mediano.x.product_name, formato: mediano.x.package_size };
      /* promozione in corso in quel negozio */
      const inAzione = arr.find(a => a.x.is_on_promotion && a.x.sale_price > 0);
      if (inAzione) {
        const v = perNostroFormato({ ...inAzione.x, current_best_price: inAzione.x.sale_price,
          price_per_unit: inAzione.x.price_per_unit });
        if (v > 0) {
          // la data di fine non c'è: le promozioni svizzere durano di norma
          // fino al lunedì successivo, quindi metto una scadenza prudente
          const fine = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
          promo[p.id] = { p: Math.round(v * 20) / 20, riv: neg, fino: fine, da: "listino" };
        }
      }
    }
    if (Object.keys(righe).length >= 2) {          // almeno due negozi: un solo dato non fa un prezzo
      prezziRiv[p.id] = righe;
      base[p.id] = { p: Math.min(...Object.values(righe)), n: Object.keys(righe).length, dettaglio };
      ok++;
    }

    /* Nutri-Score: la lettera più frequente fra i prodotti trovati */
    const gradi = trovati.map(x => x.nutriscore_grade).filter(g => g && "abcde".includes(g));
    if (gradi.length >= 4) {
      const conta = {};
      gradi.forEach(g => conta[g] = (conta[g] || 0) + 1);
      const [g, n] = Object.entries(conta).sort((a, b) => b[1] - a[1])[0];
      nutri[p.id] = { g, n: gradi.length, sicurezza: Math.round(n / gradi.length * 100), fonte: "skrimpers" };
    }
    await pausaSk(500);
  }
  log(`Skrimpers prodotti: ${ok} con prezzi per negozio, ${Object.keys(promo).length} promozioni, ${Object.keys(nutri).length} Nutri-Score${falliti ? `, ${falliti} richieste fallite` : ""}`);
  return { prezziRiv, promo, nutri, base };
}

/* ---------- carburanti alla pompa ---------- */
export async function skCarburanti(ua, plz = 6900, log = console.log) {
  try {
    const j = await chiedi(`${SK_BASE}/fuel?plz=${plz}`, ua);
    const st = j.stations || [];
    const raccogli = tipo => st.map(s => s.prices && s.prices[tipo] && s.prices[tipo].price)
      .filter(v => v > 0.5 && v < 5).sort((a, b) => a - b);
    const med = a => a.length ? +a[Math.floor(a.length / 2)].toFixed(3) : null;
    const b = raccogli("unleaded_95"), d = raccogli("diesel");
    const out = { benzina95: med(b), diesel: med(d), stazioni: st.length,
      campione: b.length + d.length, fonte: "Skrimpers (rilevazioni TCS)", plz };
    if (j.fx_rate_eur_chf) out.cambioEurChf = j.fx_rate_eur_chf;
    log(`Skrimpers carburanti (${plz}): benzina CHF ${out.benzina95 ?? "—"}, diesel CHF ${out.diesel ?? "—"} su ${st.length} stazioni`);
    return out;
  } catch (e) { log("Skrimpers carburanti non disponibili: " + e.message); return null; }
}
