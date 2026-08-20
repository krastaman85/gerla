# Gerla — Gestione Efficiente di Ricette, Liste e Acquisti
### Come funziona il sistema e come metterlo in piedi

*Progetto di **DD**, costruito insieme a Claude (Anthropic).*

Quattro file che si tengono insieme:

| File | Cosa fa |
|---|---|
| `gerla.html` | L'applicazione. Contiene il catalogo prodotti, le ricette, i menu, tutto. Funziona anche da sola, offline, senza gli altri tre. |
| `gerla-aggiorna.mjs` | Lo script che legge il catalogo da `gerla.html`, interroga le fonti aperte e riscrive il listino. |
| `gerla-listino.json` | Il listino: prezzi, qualità del dato, carburanti, fonti, rapporto dell'ultima esecuzione. È il file che l'app scarica. |
| `gerla-aggiorna.yml` | Il flusso GitHub che esegue lo script ogni mattina e ripubblica il listino. |

---

## Fase 0 — Capire il giro dei dati

```
   fonti aperte              gerla-aggiorna.mjs            gerla-listino.json          gerla.html
(Open Food Facts,      →   legge il catalogo da       →   prezzi + qualità +      →   lo scarica a
 BCE, MIMIT, TCS)          gerla.html, incrocia,          carburanti + fonti          ogni apertura
                           filtra, calcola mediane        + rapporto
```

Punto importante: **il catalogo esiste in un posto solo**, dentro `gerla.html`. Lo script non
ha una sua copia dei prodotti: apre il file dell'app, ne estrae il blocco `RAW` con espressione
regolare e lavora su quello. Così se aggiungi un prodotto dall'app e riesporti il file, lo script
lo prende in carico da solo, senza che tu debba allineare niente.

Secondo punto: **nessun prezzo viene inventato**. Se una fonte non risponde o un prodotto non
trova riscontri, il prezzo precedente resta dov'è e viene marcato `"riferimento"` invece che
`"verificato"`. Nell'app la differenza si vede: i verificati portano il marchio
`✓ dal web · n rilevazioni` con negozi e data.

---

## Fase 1 — Prova sul tuo computer (5 minuti)

Serve Node.js 20 o successivo (`node --version` per controllare; se manca, si scarica da nodejs.org).

Metti i file in una cartella e dal terminale, dentro quella cartella:

```bash
node gerla-aggiorna.mjs --html gerla.html --out gerla-listino.json
```

Vedrai qualcosa così:

```
Catalogo: 560 prodotti letti da gerla.html
Cambio EUR→CHF: 0.939 (BCE 2026-08-14)
  off-prices-ch: 807 osservazioni
  off-prices-it: 832 osservazioni
Incrocio: 24 prodotti con prezzo reale
Carburanti IT: benzina 1.729 diesel 1.652 (18420 distributori)
Scritto gerla-listino.json: 371 prezzi, di cui 24 verificati dal web.
```

Se il MIMIT va in timeout (il CSV è grosso, oltre 40 MB) lo script lo dichiara e prosegue:
i carburanti restano ai valori TCS. Non è un errore bloccante.

A questo punto puoi già usarlo così, a mano: ogni tanto lanci il comando, apri l'app,
scheda **Prezzi e volantini → Incolla un listino**, e incolli il contenuto del JSON.
Funziona, ma sei tu a doverci pensare. Le fasi seguenti servono a togliertelo di torno.

---

## Fase 2 — Il deposito GitHub

1. Crea un account su github.com se non ce l'hai.
2. In alto a destra **+ → New repository**. Nome: `gerla`. Visibilità: **Public**
   (serve perché il browser possa leggere il file senza credenziali). Non aggiungere niente altro.
   **Create repository**.
3. Nella pagina del deposito vuoto: **uploading an existing file**. Trascina dentro
   `gerla.html`, `gerla-aggiorna.mjs`, `gerla-listino.json` e questo `README.md`.
   In fondo, **Commit changes**.

Il file `.yml` va in una cartella precisa, quindi si carica in modo diverso:

4. **Add file → Create new file**.
5. Nel campo del nome scrivi esattamente, barre comprese:
   `.github/workflows/gerla-aggiorna.yml`
   (mentre scrivi le barre, GitHub crea le cartelle da sé).
6. Incolla dentro il contenuto di `gerla-aggiorna.yml`. **Commit changes**.

---

## Fase 3 — Dare al flusso il permesso di scrivere

Senza questo passaggio il flusso gira, ma non riesce a ripubblicare il listino.

1. **Settings** (nella barra del deposito) → colonna a sinistra **Actions → General**.
2. In fondo, **Workflow permissions**: scegli **Read and write permissions**. **Save**.

---

## Fase 4 — Primo avvio a mano

1. Scheda **Actions** in alto.
2. Se compare l'avviso sui flussi, clicca **I understand my workflows, go ahead and enable them**.
3. A sinistra scegli **Aggiorna listino Gerla** → a destra **Run workflow → Run workflow**.
4. Dopo un minuto la riga diventa verde. Cliccandoci dentro leggi lo stesso registro che vedevi
   sul tuo computer: quante osservazioni, quanti prezzi verificati, cosa non ha risposto.
5. Torna alla pagina principale del deposito: `gerla-listino.json` ha la data di oggi.

Da qui in avanti riparte da solo ogni mattina. Il `cron: "15 5 * * *"` è in orario UTC:
in Ticino sono **le 7:15 d'estate e le 6:15 d'inverno**. Se preferisci un altro orario cambia
quel numero (`"0 4 * * *"` = 6:00 estive) direttamente dal file su GitHub.

> GitHub sospende i flussi programmati nei depositi rimasti inattivi per 60 giorni.
> Basta una modifica qualsiasi, o un **Run workflow** manuale, per riattivarli.

---

## Fase 5 — Collegare l'app

1. Nel deposito apri `gerla-listino.json` e clicca il pulsante **Raw**.
2. Copia l'indirizzo dalla barra del browser. Ha questa forma:
   `https://raw.githubusercontent.com/TUONOME/gerla/main/gerla-listino.json`
   Nota la differenza: l'indirizzo che vedi navigando il deposito contiene `/blob/` ed è una
   **pagina**, non il file; il browser la rifiuta. Se lo incolli lo converto io nella forma
   `raw`, ma è bene sapere da dove nasce l'errore "Failed to fetch".
3. Apri l'app, scheda **Prezzi e volantini → Aggiornamento automatico**, incolla l'indirizzo nel
   campo, lascia spuntato **Aggiorna a ogni apertura**.
4. Premi **Aggiorna adesso**. Sotto compare "Aggiornati N prezzi": è collegato.

L'indirizzo resta salvato con le tue impostazioni: da adesso a ogni apertura l'app controlla il
file e si allinea da sola. Prezzi, indici per negozio, promozioni con scadenza e carburanti.

---

## Fase 6 (consigliata) — Aprire l'app dal web, non dal disco

Aprendo `gerla.html` con un doppio clic dal disco, il browser considera la pagina di origine
"nessuna": funziona quasi sempre, ma qualche configurazione blocca la lettura del listino.
Pubblicando anche l'app nello stesso deposito il problema sparisce, e in più te la ritrovi
sul telefono senza passaggi di file.

1. **Settings → Pages**.
2. **Source: Deploy from a branch**, **Branch: main**, cartella `/ (root)`. **Save**.
3. Dopo un paio di minuti l'app è a
   `https://TUONOME.github.io/gerla/gerla.html`
4. Da lì l'indirizzo del listino può essere anche solo `gerla-listino.json` (stessa cartella).
5. Sul telefono: apri quell'indirizzo, poi **Condividi → Aggiungi alla schermata Home**.
   Diventa un'icona come le altre applicazioni, si apre a tutto schermo, e la modalità
   spesa è pensata esattamente per quello.

Attenzione: la memoria dell'app è legata all'indirizzo da cui la apri. Se hai già lavorato
sul file locale, prima di passare a Pages fai **Salva le impostazioni**, e poi
**Carica impostazioni** nella nuova versione. Da quel momento usa sempre lo stesso indirizzo.

---

## Fase 7 — Quando cambi il catalogo

Se aggiungi prodotti dentro l'app ("+ Aggiungi un prodotto"), restano nelle *tue* impostazioni:
non entrano in `gerla.html` e quindi lo script non li vede. Va benissimo così.

Se invece ricevi una versione nuova di `gerla.html` con più prodotti, caricala nel deposito al
posto della vecchia: al giro successivo lo script leggerà il catalogo aggiornato e il listino
crescerà di conseguenza, senza toccare nient'altro.

---

## Cosa c'è dentro `gerla-listino.json`

```jsonc
{
 "versione": 3,
 "data": "2026-08-14",              // l'app la mostra come "listino aggiornato N giorni fa"
 "cambioEUR": 0.939,                // preso dalla BCE il giorno stesso
 "prezzi":   { "latte": 1.95, … },  // prezzo di riferimento per il formato del catalogo
 "qualita":  {                      // provenienza di ogni prezzo
   "latte": { "q":"verificato", "n":13, "data":"2026-08-11",
              "fonte":"off-prices", "negozi":["Migros","Coop"] },
   "sedano": { "q":"riferimento" }
 },
 "indici":   { "aldi": 0.80, … },   // moltiplicatore per negozio
 "promo":    { "caffe": {"p":5.95,"riv":"denner","fino":"2026-08-21"} },
 "carburanti": {
   "ch": { "benzina95":1.92, "diesel":2.11, "elettrico_kwh":0.35, "fonte":"TCS" },
   "it": { "benzina":1.729, "diesel":1.652, "fonte":"MIMIT", "campione":18420 }
 },
 "fonti":    [ … ],                 // le 14 sorgenti con tipo e indirizzo
 "rapporto": { "fonti":[{"id":"off-prices-ch","stato":"ok","osservazioni":807}] }
}
```

Il file si può correggere a mano: è testo. Se un prezzo lo conosci meglio tu, cambialo lì e al
giro successivo lo script lo lascerà stare, a meno che non trovi almeno tre rilevazioni reali
che dicano altro.

---

## Le regole che lo script si dà

- **Solo negozi svizzeri e italiani.** Un prezzo di Lione non dice niente su Lugano: filtrato via
  il codice paese del negozio.
- **Almeno tre rilevazioni** per prodotto, altrimenti il dato non entra.
- **Mediana, non media**: una fotografia sbagliata non sposta il risultato.
- **Scarto oltre il ±55%** dal prezzo di riferimento: se qualcuno ha fotografato il prezzo al
  chilo di una confezione da 200 g, quel dato viene buttato.
- **Riporto al formato del catalogo**: il prezzo osservato viene diviso per la quantità reale
  della confezione fotografata e moltiplicato per il formato nostro.
- **Conversione al cambio del giorno** per i prezzi in euro.
- **In caso di dubbio non tocca niente.**

---

## Se qualcosa non va

| Sintomo | Causa quasi certa | Rimedio |
|---|---|---|
| Il flusso fallisce con "permission denied" | permessi di scrittura non dati | Fase 3 |
| Il flusso è verde ma il file non cambia | nessun prezzo nuovo trovato quel giorno | è normale, non è un errore |
| L'app dice "Failed to fetch" | hai incollato l'indirizzo `/blob/` invece di quello `raw` | l'app lo corregge da sola; in alternativa usa il pulsante **Raw** |
| Stesso errore con l'indirizzo giusto | deposito privato | mettilo su **Public** in Settings |
| Il listino aggiornato non compare subito | GitHub tiene i file in cache qualche minuto | aspetta cinque minuti o premi **Aggiorna adesso** |
| I flussi programmati si sono fermati | 60 giorni di inattività | un **Run workflow** a mano li riaccende |
| "Catalogo: 0 prodotti letti" | `gerla.html` non è nella stessa cartella o è rinominato | usa `--html percorso/del/file.html` |
