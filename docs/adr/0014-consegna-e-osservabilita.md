# ADR 0014: Consegna con Docker, metriche e controlli di qualità

- Stato: accettata
- Data: 2026-10-21

## Contesto

Un progetto che si compila solo sul computer di chi l'ha scritto non è un prodotto. Chi apre il repository deve poterlo avviare senza installare JDK, Node e senza conoscere l'ordine in cui avviare i pezzi, e deve poter vedere come si comporta mentre gira.

## Decisione

**Un comando per l'intera applicazione.** I tre componenti hanno un Dockerfile e il compose li avvia con il profilo `app`. Le immagini dei servizi si costruiscono in due fasi (JDK per compilare, solo JRE per eseguire) e girano con un utente non privilegiato. Il frontend è servito da nginx. Senza profilo il compose avvia solo PostgreSQL e Kafka, per chi sviluppa i servizi sul proprio computer.

**Un solo punto d'ingresso.** nginx serve l'applicazione e inoltra `/api` a order-service e `/api/v1/notifications` a notification-service (senza buffer e con timeout lungo per lo stream SSE). Le porte dei servizi non sono pubblicate. Una `Content-Security-Policy` stretta, senza script in linea, e le intestazioni `nosniff`, `X-Frame-Options` e `Referrer-Policy` limitano i danni di un eventuale XSS (ADR 0013). Per questo l'inline del CSS critico è disattivato nella build di produzione di Angular.

**Metriche aperte solo nella rete interna.** `/actuator/prometheus` risponde senza token perché Prometheus non ne ha uno. Non contiene dati sensibili e non è raggiungibile da fuori: nginx non lo inoltra e le porte dei servizi restano nella rete di Docker. Ogni altro endpoint di gestione richiede il ruolo ADMIN. In produzione la protezione sarebbe una regola di rete. Si era provata una porta di gestione separata, ma nel servizio reattivo la catena di sicurezza dell'applicazione non vale sulla porta secondaria: la soluzione più semplice e identica nei due servizi era preferibile.

**Osservabilità opzionale.** Con il profilo `observability` partono Prometheus e Grafana, con una dashboard già configurata: stato dei servizi, richieste e latenza p95, eventi in attesa e pubblicati dell'outbox, client SSE, notifiche e duplicati scartati, memoria e connessioni al database. Entrambi ascoltano solo su `localhost`.

**Qualità misurata, non dichiarata.** JaCoCo fa fallire il build se la copertura delle righe di un servizio scende sotto l'85% (oggi 95% e 94%). Il frontend produce la copertura con Vitest (circa 59%, concentrata su sessione, interceptor, flusso SSE e schermate di accesso e dettaglio ordine). La CI costruisce anche le immagini Docker. L'analisi SonarCloud è pronta ma si attiva solo con un account e il segreto `SONAR_TOKEN` (docs/qualita.md): senza segreto il job viene saltato e non blocca nessuno.

**Dati di esempio.** `deploy/seed.mjs` carica catalogo, clienti e ordini in tutti gli stati tramite l'API. Si può rilanciare senza duplicare.

## Conseguenze

- I valori predefiniti del compose (segreto JWT e password di amministratore) sono di demo e dichiarati tali; fuori dal proprio computer vanno sostituiti.
- Ogni scheda aperta tiene una connessione SSE; con HTTP/1.1 un browser ne consente circa sei per origine. Il limite si supera con HTTP/2 davanti al frontend, configurato poi nell'ADR 0015.
- Il percorso nel browser (accesso, ordine, conferma, notifiche in diretta) ha ora un test automatico in `e2e/`, eseguito nel job `e2e` della CI; il resto delle schermate è stato verificato a mano.
