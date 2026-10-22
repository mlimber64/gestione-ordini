# Cronologia delle versioni

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/); il versionamento segue [SemVer](https://semver.org/lang/it/).

## [Non rilasciato]

### Modificato
- **Interfaccia rinnovata** (ADR 0022, prima parte dell'incidenza #39): sistema di design con palette petrolio e token, tema chiaro, scuro o del sistema, menu laterale scuro comprimibile (cassetto sui telefoni), barra superiore con percorso e utente, accesso a due colonne e un nuovo cruscotto con fascia «da gestire», quote per stato, anello degli ordini, scorte con barre e attività con icone per tipo.

## [1.1.0] - 2026-10-22

Novità principali: accesso con Keycloak e refresh in un cookie HttpOnly, CDC con Debezium, pagamenti, immagini pubblicate su GHCR, HTTPS con HTTP/2, pulizia delle notifiche e test di punta a punta con Playwright.

### Aggiunto
- Accesso con **Keycloak** come alternativa al login interno (ADR 0021): `deploy/docker-compose.keycloak.yml` aggiunge Keycloak 26 con un realm importato (utenti `admin`, `operatore`, `lettore`) dietro nginx su `/auth`. Authorization Code con PKCE sulla pagina di accesso di Keycloak; i due servizi verificano i token RS256 con le chiavi pubbliche (JWKS), senza segreto condiviso. Nuova proprietà `app.auth.mode` (`local` di base, oppure `oidc`), `GET /api/v1/auth/config`, pulsante «Accedi con Keycloak» e job `e2e` della CI anche in questa configurazione.
- CDC con Debezium come alternativa al polling dell'outbox (ADR 0019): `deploy/docker-compose.cdc.yml` aggiunge Kafka Connect con il connettore dell'outbox e porta order-service in modalità `cdc` (`app.outbox.mode`), senza cambiare il contratto degli eventi. Il job `e2e` della CI gira ora in entrambi i modi.
- Pagamenti (ADR 0018): registrazione manuale di bonifici, carte e contrassegni per ogni ordine, con stati `In attesa`, `Incassato`, `Non riuscito` e `Rimborsato`, acconti e saldo, e riepilogo `Da pagare` / `Pagato in parte` / `Pagato`. Il pagamento non cambia lo stato dell'ordine e non può superare il totale nemmeno con richieste simultanee (lock consultivo di PostgreSQL). Nuova tabella `payment` (migrazione V4), API, sezione nel dettaglio dell'ordine, dati di esempio e test di punta a punta.
- Pubblicazione delle immagini Docker su GHCR a ogni tag `v*` (workflow `release-images.yml`) e `deploy/docker-compose.ghcr.yml` per usarle senza compilare (ADR 0017).
- Pulizia notturna delle notifiche: notification-service elimina quelle ricevute da più di 30 giorni (`app.notifications.retention`), oltre la conservazione di Kafka per non rompere l'idempotenza del consumer (ADR 0016).
- HTTPS con HTTP/2 davanti al frontend (porta `8443`, certificato autofirmato creato all'avvio) per superare il limite di ~6 connessioni SSE per origine di HTTP/1.1 (ADR 0015). Un test con otto schede nello stesso browser lo verifica.
- Test di punta a punta con Playwright (`e2e/`): accesso, creazione e conferma di un ordine e notifiche ricevute in diretta, sull'applicazione completa avviata con il profilo `app`. Girano nel nuovo job `e2e` della CI.

### Modificato
- **Il token di refresh passa da `sessionStorage` a un cookie `HttpOnly`** (ADR 0020): un XSS non può più rubarlo. Cambia l'API di autenticazione: `login` e `refresh` restituiscono solo il token di accesso, `refresh` legge il cookie (non accetta più il token nel corpo) e c'è un nuovo `POST /api/v1/auth/logout`. Il cookie è `SameSite=Strict`, limitato a `/api/v1/auth`, `Secure` in HTTPS e «di sessione». Le schede dello stesso browser condividono la sessione.
- La pulizia notturna dell'outbox è una classe a parte (`OutboxCleanup`) e funziona nei due modi. La proprietà `app.outbox.relay.enabled` è sostituita da `app.outbox.mode` (`polling` di base, oppure `cdc`).

## [1.0.0] - 2026-10-21

Prima versione stabile.

### Aggiunto
- Immagini Docker per i tre componenti e profilo `app` del compose: l'intera applicazione parte con un comando.
- nginx come unico punto d'ingresso, con `Content-Security-Policy` stretta e intestazioni di sicurezza.
- Prometheus e Grafana (profilo `observability`) con la dashboard «Gestione Ordini».
- Dati di esempio con `deploy/seed.mjs`.
- Copertura con JaCoCo e Vitest; il build dei servizi fallisce sotto l'85% di righe coperte.
- Job SonarCloud nella CI (si attiva con il segreto `SONAR_TOKEN`) e build delle immagini in CI.
- Licenza MIT, ADR 0014, `docs/qualita.md` e README con immagini.
- Test frontend per guardie, accesso, dettaglio ordine e flusso delle notifiche (45 in totale).

### Modificato
- `/actuator/prometheus` risponde senza token (solo rete interna); gli altri endpoint di gestione richiedono ADMIN.
- Build di produzione di Angular senza inline del CSS critico, per rispettare la CSP.

### Corretto
- Chip dello storico ordine stirati per un conflitto di classi CSS.

## [0.9.0] - M5: applicazione web

Applicazione Angular 22 con Angular Material: accesso con sessione e refresh, cruscotto, ordini, clienti, prodotti, magazzino e notifiche in tempo reale (SSE). ADR 0013.

## [0.5.0] - M4: notifiche in tempo reale

notification-service reattivo: consumer idempotente, dead-letter, stream SSE con ripresa tramite `Last-Event-ID` e verifica dei JWT. ADR 0012.

## [0.4.0] - M3: eventi

Transactional outbox, relay verso Kafka, eventi `OrderCreated`, `OrderStatusChanged` e `StockLow`. ADR 0011.

## [0.3.0] - M2: magazzino e ordini

Giacenze con riserva atomica, ordini con macchina a stati e storico, test di concorrenza. ADR 0010.

## [0.2.0] - M1: identità e catalogo

Login JWT con ruoli, clienti e indirizzi, categorie e prodotti. ADR 0009.

## [0.1.0] - M0: fondamenta

Struttura del repository, infrastruttura locale, CI e prime decisioni di progetto.
