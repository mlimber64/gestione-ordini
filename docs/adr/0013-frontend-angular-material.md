# ADR 0013: Frontend Angular con Material, sessione in memoria e SSE con fetch

- Stato: accettata
- Data: 2026-10-21

## Contesto

L'applicazione web deve coprire login, clienti, prodotti, magazzino, ordini e notifiche in tempo reale. Va tenuta semplice da mantenere e sicura nella gestione del token.

## Decisione

**Angular 22 con componenti standalone, signals e rotte caricate a richiesta.** Nessun NgModule, nessuna libreria di stato: i servizi con `signal` bastano. Ogni schermata è un chunk separato; il bundle iniziale resta sotto i 700 kB (circa 160 kB trasferiti).

**Angular Material con un tema sobrio.** Tema Material 3 azzurro, superfici neutre e densità compatta per le tabelle. Font (Inter) e icone sono pacchetti npm serviti dall'applicazione: nessuna richiesta a Google Fonts, quindi nessun problema di privacy né di build offline. Le etichette del paginatore sono in italiano.

**Sessione.** Il token di accesso (15 minuti) vive solo in memoria. Il token di refresh sta in `sessionStorage`: un ricaricamento della pagina non obbliga a rifare il login, ma chiudere la scheda sì. Un interceptor aggiunge il token alle chiamate `/api/`; su un `401` chiede un token nuovo una sola volta (più richieste simultanee condividono la stessa chiamata di refresh) e ripete la richiesta; se il refresh fallisce, chiude la sessione.

**I permessi si nascondono nell'interfaccia ma li applica il server.** I pulsanti di scrittura compaiono solo per ADMIN e OPERATOR e le guardie di rotta evitano schermate inutili, ma la sicurezza è nei controlli del backend (`@PreAuthorize`), che restano l'unica fonte di verità.

**Notifiche con `fetch` in streaming, non `EventSource`.** `EventSource` non può inviare l'intestazione `Authorization` e il token non deve stare nell'URL. Un piccolo interprete SSE legge lo stream, si ricollega da solo con backoff crescente e invia `Last-Event-ID`: il server rimanda quanto è stato perso (ADR 0012). Il server invia un `ping` appena la connessione si apre, così il client sa subito di essere collegato.

**Un solo indirizzo in sviluppo.** `ng serve` usa un proxy (`proxy.conf.json`): `/api/v1/notifications` va a notification-service (8082), il resto a order-service (8081). Il browser vede un'unica origine, quindi non serve configurare CORS nei backend. In produzione lo stesso instradamento spetta a un reverse proxy.

**Errori leggibili.** Le risposte `problem+json` (RFC 9457) diventano messaggi in italiano: l'elenco dei campi non validi, o il dettaglio della regola violata (per esempio "Giacenza insufficiente per PEN-01: richiesti 15, disponibili 5").

## Conseguenze

- Il token di refresh in `sessionStorage` è leggibile da uno script nella stessa pagina: un XSS lo esporrebbe. Si riduce il rischio con la CSP e l'assenza di HTML dinamico non fidato, ma non lo si elimina; con un identity provider si userebbe un cookie `HttpOnly`.
- Il totale mostrato nel nuovo ordine è una stima: il calcolo definitivo (con arrotondamenti per riga) lo fa il server.
- I test unitari coprono sessione, interceptor, interprete SSE e validazioni; il percorso nel browser è provato dai test di punta a punta in `e2e/` (Playwright), che coprono solo il flusso principale.
