# ADR 0003: Spring MVC per gli ordini, WebFlux per le notifiche

- Stato: accettata
- Data: 2026-10-21

## Contesto

Spring offre due modelli web: bloccante (MVC) e reattivo (WebFlux). Usarne uno solo ovunque semplifica, ma non sempre è la scelta migliore.

## Decisione

- **order-service** usa **Spring MVC con thread virtuali** e JPA. Contiene transazioni su più tabelle, relazioni e lock ottimistico.
- **notification-service** usa **WebFlux con R2DBC**. Consuma eventi e gestisce molti client SSE connessi.

## Conseguenze

- JPA offre mapping delle relazioni e transazioni mature, dove servono davvero.
- Il modello reattivo si usa solo dove porta un vantaggio concreto.
- Il progetto richiede di conoscere entrambi i modelli.
