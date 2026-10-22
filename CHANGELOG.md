# Cronologia delle versioni

Il formato segue [Keep a Changelog](https://keepachangelog.com/it/); il versionamento segue [SemVer](https://semver.org/lang/it/).

## [Non rilasciato]

### Aggiunto
- Pulizia notturna delle notifiche: notification-service elimina quelle ricevute da più di 30 giorni (`app.notifications.retention`), oltre la conservazione di Kafka per non rompere l'idempotenza del consumer (ADR 0016).
- HTTPS con HTTP/2 davanti al frontend (porta `8443`, certificato autofirmato creato all'avvio) per superare il limite di ~6 connessioni SSE per origine di HTTP/1.1 (ADR 0015). Un test con otto schede nello stesso browser lo verifica.
- Test di punta a punta con Playwright (`e2e/`): accesso, creazione e conferma di un ordine e notifiche ricevute in diretta, sull'applicazione completa avviata con il profilo `app`. Girano nel nuovo job `e2e` della CI.

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
