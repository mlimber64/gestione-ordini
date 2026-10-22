# Qualità e osservabilità

Cosa controlla il progetto da solo e come si attiva ciò che richiede un account.

## Controlli automatici (già attivi)

| Controllo | Dove | Cosa garantisce |
|---|---|---|
| Test unitari e di integrazione | CI, jobs `order-service`, `notification-service`, `web` | 147 + 20 + 110 test. Gli integrativi usano PostgreSQL e Kafka reali (Testcontainers) |
| Copertura minima | JaCoCo, `./mvnw verify` | Il build fallisce se la copertura delle righe dei servizi scende sotto l'85% (oggi 96% e 95%) |
| Regole di architettura | ArchUnit, dentro i test di `order-service` | Le dipendenze vanno solo verso il dominio e le funzionalità non si toccano tra loro |
| Build delle immagini | CI, job `docker` | I Dockerfile e il compose si costruiscono a ogni modifica |
| Protezione di `main` | Impostazioni di GitHub | Serve un pull request con i tre jobs principali verdi |
| Aggiornamento delle dipendenze | Dependabot | Pull request automatici per Maven, npm e GitHub Actions |

## SonarCloud (richiede un account)

Il job `sonarcloud` della CI è già scritto ma resta inattivo finché non esiste il segreto `SONAR_TOKEN`. Per attivarlo:

1. Accedi a [sonarcloud.io](https://sonarcloud.io) con l'account GitHub e importa il repository `gestione-ordini` (piano gratuito per i repository pubblici).
2. In *Administration → Analysis Method* scegli **GitHub Actions** (disattiva l'analisi automatica, che non vede la copertura).
3. Copia il token che SonarCloud mostra e salvalo in GitHub: *Settings → Secrets and variables → Actions → New repository secret*, con nome `SONAR_TOKEN`.
4. Controlla in `sonar-project.properties` che `sonar.organization` e `sonar.projectKey` coincidano con quelli di SonarCloud.

Dal prossimo pull request l'analisi parte da sola e il risultato compare nel pull request.

## Metriche e dashboard

Con `docker compose --profile app --profile observability up -d --build` partono anche Prometheus (`http://localhost:9090`) e Grafana (`http://localhost:3000`, sola lettura senza accesso). Il cruscotto *Gestione Ordini* mostra:

- stato dei due servizi;
- richieste al secondo e latenza p95 delle API;
- eventi in attesa di pubblicazione (outbox), eventi pubblicati e invii falliti;
- client SSE collegati, notifiche ricevute e duplicati scartati;
- memoria della JVM e connessioni al database.

Le metriche stanno su `/actuator/prometheus` e non sono raggiungibili da fuori: il reverse proxy inoltra solo `/api` e le porte dei servizi non sono pubblicate (vedi ADR 0014).

## Dati di esempio

`node deploy/seed.mjs` carica prodotti, clienti e ordini in stati diversi tramite l'API, così l'applicazione si prova subito (si può rilanciare senza duplicare).
