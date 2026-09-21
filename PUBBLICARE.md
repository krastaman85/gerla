# Gerla — pubblicare gli aggiornamenti in un clic

Serve una volta sola: mezz'ora di preparazione, e da lì in poi ogni aggiornamento
è un doppio clic. Il listino dei prezzi continua ad aggiornarsi da solo ogni mattina:
questo riguarda solo i file dell'applicazione, quando te ne mando di nuovi.

---

## Preparazione (una volta sola)

**1. Installa GitHub Desktop** — https://desktop.github.com
   È il modo più semplice per avere Git funzionante e già collegato al tuo account,
   senza toccare token o password.

**2. Porta il deposito sul computer.**
   In GitHub Desktop: *File → Clone repository → krastaman85/gerla*.
   Scegli una cartella, per esempio `Documenti\GitHub\gerla`.
   Quella cartella diventa la copia locale del sito: quello che ci metti dentro
   e pubblichi, finisce online.

**3. Metti lo script dentro quella cartella.**
   Copia `aggiorna-gerla.bat` (Windows) oppure `aggiorna-gerla.sh` (Mac e Linux)
   dentro `Documenti\GitHub\gerla`, accanto a `gerla.html`.

---

## Ogni volta che ti mando file nuovi

1. Scaricali (finiscono in **Download**, con il nome giusto già pronto).
2. Doppio clic su **aggiorna-gerla.bat**.
3. Rispondi `s` alla domanda finale se vuoi lanciare subito anche l'aggiornamento prezzi.

Lo script fa, in ordine:

- scarica dal deposito le novità già pubblicate (il listino rigenerato dal flusso),
  così non sovrascrivi mai un dato più recente con uno vecchio;
- copia dalla cartella Download solo i file di Gerla che trova, mettendo
  `gerla-aggiorna.yml` nella sottocartella giusta `.github/workflows/`;
- se qualcosa è cambiato davvero, prepara la modifica e la invia a GitHub;
- se non è cambiato niente, te lo dice e non fa nulla.

Due minuti dopo il sito è aggiornato. Sul telefono o sul computer, ricarica
tenendo premuto **Ctrl+Maiusc+R** (su Mac **Cmd+Maiusc+R**) per saltare la cache.

---

## Se qualcosa non va

| Messaggio | Cosa fare |
|---|---|
| *Git non risulta installato* | Installa GitHub Desktop, poi riapri lo script |
| *Questa cartella non è un deposito Git* | Hai messo lo script fuori dalla cartella clonata: spostalo dentro |
| *Invio non riuscito* | Apri GitHub Desktop una volta e accedi: da lì in poi le credenziali restano |
| *Nessun file nuovo trovato* | I file non sono in Download, o hanno un nome diverso da quello atteso |

---

## Perché non lo faccio io direttamente

Per scrivere sul tuo deposito servirebbe una tua credenziale di accesso. Non è una
cosa da consegnare in una conversazione: resterebbe scritta, e il computer su cui
lavoro viene azzerato a ogni sessione, quindi la dovresti ripassare ogni volta.
Un token con permesso di scrittura è una chiave di casa. Questo script ottiene lo
stesso risultato — un clic — lasciando la chiave dove deve stare, cioè da te.
