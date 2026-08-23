# Gerla — guida del proprietario
### Com'è fatta dentro, come si modifica, cosa fare quando si rompe

*Ideata e diretta da **DD**, costruita insieme a Claude (Anthropic).*

Questo documento è per chi mantiene il progetto. Per l'uso quotidiano c'è la scheda
**Guida** dentro l'applicazione.

---

## 1. L'idea, in una riga

Le ricette parlano di **ingredienti** ("100 g di latte"). I negozi vendono **prodotti**
("Valflora Vollmilch 3.5% UHT 1 l"). Gerla tiene i due mondi separati e costruisce un
ponte automatico fra loro. È la decisione architetturale che regge tutto il resto.

```
 ricette  →  ingredienti  →  [ legatore ]  →  prodotti veri  →  prezzi, offerte, Nutri-Score
   288          619            automatico        41'913            9 negozi svizzeri
```

Perché non far puntare le ricette direttamente ai prodotti: cambiano ogni settimana,
sono diversi in ogni catena, e cercando "Milch" da Migros escono 216 articoli fra cui
cioccolato e dessert. Una ricetta legata a un codice prodotto si romperebbe da sola.

---

## 2. Il giro dei dati

**Ogni mattina alle 7:15** — `gerla-aggiorna.yml`, una quindicina di secondi:
offerte dai nove negozi, carburanti alla pompa, cambio BCE, rilegatura degli ingredienti,
allineamento della versione dell'app.

**Ogni martedì alle 5:40** — `gerla-catalogo.yml`, una ventina di minuti:
catalogo completo dei nove negozi, prezzi prodotto per prodotto, Nutri-Score, rilegatura.

La divisione non è casuale: interrogare 400 prodotti costa **dodici minuti**, mentre
offerte, carburanti e cambio insieme stanno **sotto il minuto**. I prezzi di listino
cambiano di settimana in settimana, le offerte ogni giorno.

Il martedì è scelto: i volantini svizzeri escono quel giorno.

---

## 3. La regola che protegge i dati

**Un dato che non si è potuto raccogliere non viene mai sovrascritto con un ripiego.**

Se una fonte non risponde, si tiene quello dell'ultimo giro riuscito **con la sua data
vera**, e il registro lo dichiara:

```
Cambio BCE non raggiungibile: tengo 0.9333 del giro precedente.
Carburanti CH non raggiungibili: tengo il dato del 2026-08-21.
Prezzi per negozio: raccolti 0 contro 74 del giro precedente. Tengo i vecchi.
```

Vale per cambio, carburanti svizzeri e italiani, prezzi per negozio, offerte, catalogo
e legature. Il legatore in più si ferma del tutto se trova meno negozi del giro
precedente o lega meno del 90% degli ingredienti: pubblicare un file più povero
cancellerebbe mesi di correzioni.

Il motivo è semplice: un valore di ripiego **datato oggi** è peggio di un dato vecchio
dichiarato tale, perché nell'app appare verde e fresco.

---

## 4. Le correzioni: come cresce la qualità

Il legatore azzecca circa due abbinamenti su tre. Il terzo lo correggi tu, e resta.

1. Nel listino, sotto il miglior prezzo, c'è il nome del prodotto vero con una matita.
2. Toccalo: si apre l'elenco delle alternative già scaricate. Scegli quella giusta,
   oppure **Nessuno di questi va bene** se in quel negozio non c'è niente di adatto.
3. Il prezzo cambia subito in piano e lista.
4. Quando ne hai accumulate: **Esporta le correzioni** → carichi `gerla-correzioni.json`
   nel deposito → il legatore le rispetta a ogni giro.

Due significati distinti nel file: `voci` sono le scelte ("usa questo codice"),
`__esclusi__` sono le esclusioni ("in questo negozio non c'è niente di adatto,
non proporne un altro").

---

## 5. Struttura dell'applicazione

Un file solo, circa 616 kB. Il peso non è un problema: si scarica una volta e resta.

**Le sezioni**: Piano (menu · lista · analisi), Occasioni, Casa (dispensa · storico),
Ricette, Prezzi (catalogo · offerte · aggiornamento), Guida.

**Lo stato** vive tutto in `S` e viene salvato nella memoria del browser. Non esiste
nessun server: i dati restano sul dispositivo di chi usa l'app.

**Il motore dei prezzi** ha una gerarchia precisa: promozione viva → prezzo del prodotto
vero legato a quel negozio → prezzo rilevato → stima. Ogni riga del listino dichiara da
dove viene il suo numero.

**Il generatore dei menu** usa punteggi pesati (costo, salute, stagione, gradimento),
un intervallo minimo fra le ripetizioni, un tetto agli usi dello stesso piatto, e un
"perno" che evita lo stesso ingrediente principale a pranzo e a cena. Il seme rende il
risultato riproducibile.

**Il disegno è differito**: guida e ricettario si costruiscono alla prima apertura.
All'avvio l'app sta sotto gli 11'600 nodi e si carica in circa un secondo e mezzo.

---

## 6. Le prove

Due batterie, con scopi diversi. Girano a ogni caricamento.

**`prove.mjs`** — venti controlli sui conti, quindici secondi, senza browser: dati
integri, nessun ingrediente orfano, generatore che non ripete, diete rispettate,
lista coerente, dizionari allineati.

**`prove-browser.mjs`** — trentaquattro controlli aprendo l'app davvero: ogni scheda si
apre, ogni ricerca filtra, ogni filtro cambia il risultato, niente scorrimento laterale.

La seconda esiste perché la prima non può vedere un pulsante che non apre niente.
È così che è stata trovata la Guida rotta.

---

## 7. Modificare i dati dell'app

Prodotti, ricette e portate stanno in tabelle compatte dentro `gerla.html`.

```js
["pasta","Pasta di semola","Carboidrati",2.20,500,"g","🍝",350,12,3,0,0,"glutine"]
//  id      nome            reparto     prezzo qtà unità icona kcal prot salute … allergeni

{id:"carbonara",n:"Carbonara",q:"pranzo",m:25,
 ing:[["pasta",100],["pancetta",55],["uova",1.2],["pecorino",35]],
 t:["maiale","tradizione","veloce","glutine","uova","lattosio"]}
```

**Dopo ogni modifica, sempre `node prove.mjs`**: prende gli ingredienti inesistenti,
che sono l'errore più facile da fare.

---

## 8. Quando qualcosa si rompe

| Sintomo | Causa quasi certa |
|---|---|
| Il flusso fallisce su "Pubblica" | Permessi di scrittura non attivi, o un caricamento a mano nel frattempo (riprova tre volte da sé) |
| Il giro dura 12 minuti invece di 15 secondi | `gerla-aggiorna.mjs` sul deposito è vecchio e non conosce `--leggero` |
| L'app installata non si aggiorna | Manca `gerla-sw.js`, o la sua versione non è cambiata |
| Non funziona senza rete | Il service worker non si è installato: apri gli strumenti di sviluppo → *Application → Service Workers* |
| I filtri non filtrano | Uno stato salvato in formato vecchio: *cancella e ripristina* |
| Le prove falliscono su "ingrediente orfano" | Una ricetta cita un prodotto che non esiste: il registro dice quale |

---

## 9. Le fonti, e il rispetto che meritano

**Skrimpers** regge quasi tutto: prezzi per negozio, offerte con scadenza vera,
Nutri-Score, carburanti. È un'interfaccia pubblica ma **non documentata**, senza licenza
dichiarata. Gerla la interroga con parsimonia — circa 500 richieste a settimana, mezzo
secondo di pausa fra l'una e l'altra, un'intestazione che dichiara chi siamo e che l'uso
non è commerciale — e si disattiva con `--no-skrimpers`.

**Prima di renderla pubblica va chiesto il permesso.** Non è formalità: tutto il valore
del progetto poggia su quella fonte, e un sì scritto vale più di qualunque funzione.

Le altre: Open Food Facts Prices, MIMIT (carburanti italiani), BCE (cambio),
GialloZafferano (collegamenti alle ricette, 155 titoli verificati).

---

## 10. Quello che non c'è, e perché

**Nessun server, nessun account.** I dati restano sul dispositivo. È una scelta, non un
limite di mezzi: cambia cosa si può costruire e cosa no.

**Le spunte non si sincronizzano** fra due telefoni. Per questo la lista si *divide* per
negozio invece di sincronizzarsi: ognuno spunta la sua parte e non c'è niente da tenere
allineato.

**Il catalogo copre solo l'alimentare.** Su 63 categorie dei negozi, per casa e igiene
ce n'è una sola: per detersivi, shampoo e carta resta il prezzo di riferimento, e l'app
lo dichiara.

**La guida dentro l'app è solo in italiano.** Il resto è tradotto in quattro lingue.

---

*MMXXVI*
