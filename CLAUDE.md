# Gerla: memoria di progetto (leggila prima di lavorare)

Se questo file e il repo divergono, fidati del repo e correggi il file. `README.md` e `PUBBLICARE.md` sono le fonti dettagliate.

## Cos'è
Gerla decide cosa cucinare, calcola quanto costa nei negozi che frequenti e dice se conviene attraversare il confine (Ticino, Como, Varese, Lecco, Sondrio). Sito: https://gerla.diasio.ch/gerla.html (file `CNAME`, GitHub Pages da `main`, cartella `/`). Progetto di DD costruito con Claude.

## Struttura
- App: `gerla.html` (tutta l'app in un file solo), `gerla-sw.js`, `manifest.json`, icone e `vetrina-*.png`.
- Dati che si aggiornano da soli (NON modificarli a mano): `gerla-listino.json`, `gerla-promozioni.json`, `gerla-ingredienti.json`, `catalogo/*.json`. `gerla-correzioni.json` è caricato dall'utente.
- Script: `gerla-aggiorna.mjs`, `gerla-skrimpers.mjs`, `gerla-catalogo.mjs`, `gerla-lega.mjs`, prove in `prove/`.
- Workflow (`.github/workflows/`): `gerla-aggiorna` ogni mattina alle 7:15, `gerla-catalogo` ogni martedì alle 5:40, `gerla-test` a ogni modifica. I commit automatici dei dati vanno su `main`: fai sempre `git pull` prima di lavorare.

## Regole
- Skrimpers è la fonte principale dei prezzi: interfaccia pubblica non documentata, interrogata con parsimonia (circa 500 richieste a settimana). **Prima di usarla in un progetto pubblico va chiesto il permesso.** Non aumentare la frequenza.
- Chi ha installato l'app vede «Aggiorna» solo se il flusso quotidiano aggiorna la versione del service worker: se cambi `gerla.html`, ricorda che il flusso lo gestisce da sé.
- L'utente pubblica gli aggiornamenti dell'app dal proprio PC con `aggiorna-gerla.bat` (cartella locale `Documenti\GitHub\gerla`, file presi da Download). Nessuna credenziale o token passa in conversazione (vedi `PUBBLICARE.md`).

## Regole di lavoro dell'utente
Italiano, chiaro e operativo. Distinguere dati da inferenze. Dire cosa fa l'utente e cosa fa Claude. Se manca un'informazione importante, chiedere prima. Non pubblicare, inviare o cancellare senza conferma. Una sola sessione di lavoro alla volta, con titolo «Gerla – …».
