# Gerla
### La spesa e i menu di casa, con i prezzi veri dei negozi

*Progetto di **DD**, costruito insieme a Claude (Anthropic).*

Gerla decide cosa cucinare per la settimana, calcola quanto costa davvero nei negozi
che frequenti, e ti dice se conviene attraversare il confine. Vive in Ticino, dove la
spesa transfrontaliera è normale e nessuno ha mai scritto software per quella normalità.

**Sito**: https://krastaman85.github.io/gerla/gerla.html

---

## Cosa c'è dentro, in numeri

| | |
|---|---|
| Ingredienti nel catalogo di casa | **619** |
| Legati a prodotti veri dei negozi | **406** (66%) |
| Prodotti reali dei negozi svizzeri | **41'913** su 9 catene |
| Offerte in corso, con scadenza vera | **~3'500** |
| Ricette | **288** di 13 cucine |
| Portate per le occasioni | **262** in 43 menu |
| Lingue | italiano, inglese, francese, tedesco |

---

## Come sono divisi i file

**L'applicazione**

| File | Cosa fa |
|---|---|
| `gerla.html` | Tutta l'app in un file solo: catalogo, ricette, menu, motore dei prezzi, interfaccia. Funziona anche da sola, senza rete e senza gli altri file. |
| `gerla-sw.js` | Fa funzionare l'app senza rete e gestisce gli aggiornamenti di chi l'ha installata. |
| `manifest.json` + `icona-*.png` + `vetrina-*.png` | Servono a installarla sul telefono: nome, icone, anteprime, scorciatoie. |

**I dati, che si aggiornano da soli**

| File | Cosa contiene | Ogni quanto |
|---|---|---|
| `gerla-listino.json` | Prezzi, carburanti, cambio, qualità del dato | ogni giorno |
| `gerla-promozioni.json` | Le offerte in corso nei nove negozi | ogni giorno |
| `gerla-ingredienti.json` | Il ponte fra le ricette e i prodotti veri | ogni giorno |
| `catalogo/*.json` | Il catalogo dei negozi, un file per catena | ogni martedì |
| `gerla-correzioni.json` | Le tue correzioni agli abbinamenti *(lo carichi tu)* | quando vuoi |

**Gli script**

| File | Cosa fa |
|---|---|
| `gerla-aggiorna.mjs` | Raccoglie prezzi, carburanti e cambio; scrive il listino |
| `gerla-skrimpers.mjs` | Parla con la fonte svizzera dei prezzi |
| `gerla-catalogo.mjs` | Scarica il catalogo dei negozi e le offerte |
| `gerla-lega.mjs` | Lega ogni ingrediente al prodotto vero più adatto in ogni negozio |
| `prove.mjs` · `prove-browser.mjs` | Le due batterie di prove |

**I flussi automatici** (in `.github/workflows/`)

| File | Quando | Quanto dura |
|---|---|---|
| `gerla-aggiorna.yml` | ogni mattina alle 7:15 | ~15 secondi |
| `gerla-catalogo.yml` | ogni martedì alle 5:40 | ~20 minuti |
| `gerla-test.yml` | a ogni modifica caricata | 20 s + 3 min |

---

## Come si mette in piedi da zero

**1. Il deposito.** Crea un deposito pubblico su GitHub e carica tutti i file qui sopra,
rispettando due sole regole: i tre `.yml` vanno in `.github/workflows/`, e i file del
catalogo dentro una cartella `catalogo/`.

**2. I permessi.** *Settings → Actions → General → Workflow permissions* →
**Read and write permissions**. Senza, i flussi raccolgono i dati ma non riescono
a pubblicarli.

**3. Il sito.** *Settings → Pages* → *Deploy from a branch*, ramo `main`, cartella `/`.
Dopo un paio di minuti l'app è online.

**4. La prova.** *Actions → Aggiorna listino Gerla → Run workflow*. Nel registro devono
comparire le offerte raccolte, i carburanti e la pubblicazione riuscita.

Nient'altro da configurare: l'app trova i suoi dati da sola, accanto a sé.

---

## Come si aggiorna

**I dati non li tocchi mai.** Listino, offerte, catalogo e legature si rigenerano da soli.

**L'app**, quando arriva una versione nuova: carichi `gerla.html`. Il flusso quotidiano
si accorge che è cambiata e aggiorna da sé la versione del service worker, così chi ha
installato Gerla vede comparire il pulsante **Aggiorna**.

---

## Se qualcosa non va

| Sintomo | Dove guardare |
|---|---|
| I prezzi non si aggiornano | *Actions*: l'ultimo giro è verde? Nel registro c'è "Pubblicato"? |
| La scheda Offerte è vuota | Manca `gerla-promozioni.json`, oppure i negozi accesi non hanno offerte |
| "Catalogo esteso non disponibile" | Manca la cartella `catalogo/` o i nomi dei file non corrispondono |
| Sotto i prezzi non c'è il prodotto vero | Manca `gerla-ingredienti.json` |
| L'app installata resta vecchia | Non hai caricato `gerla-sw.js` |
| Non funziona aprendo il file dal disco | È normale: serve un sito. Il browser vieta a una pagina locale di leggere gli altri file |

La spia accanto a *dati salvati nel dispositivo* dice sempre a che punto è il sistema:
verde con il numero dei negozi collegati, oro se mancano i dati estesi, azzurro senza
rete, rosso se ci sono solo stime.

---

## Le fonti

**Skrimpers** (`skrimpers.com`) è la fonte principale: prezzi reali negozio per negozio,
offerte con la scadenza vera, Nutri-Score, carburanti alla pompa. È un'interfaccia
pubblica ma non documentata: viene interrogata con parsimonia — circa 500 richieste a
settimana, con pause fra l'una e l'altra e un'intestazione che dice chi siamo.
**Prima di usarla in un progetto pubblico va chiesto il permesso.**

Le altre: Open Food Facts Prices per i prezzi comunitari, il ministero italiano
(MIMIT) per i carburanti di Como, Varese, Lecco e Sondrio, la BCE per il cambio,
GialloZafferano per i collegamenti alle ricette.

---

*MMXXVI*
