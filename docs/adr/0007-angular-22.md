# ADR 0007: Angular 22

- Stato: accettata
- Data: 2026-10-21

## Contesto

Serve un frontend moderno per gestire clienti, prodotti, magazzino e ordini, con aggiornamenti in tempo reale.

## Decisione

Usiamo **Angular 22** con TypeScript 6: componenti standalone, signals, form reattivi tipizzati e rotte caricate a richiesta. Il client HTTP sarà generato dal contratto OpenAPI. Gli eventi arrivano tramite `EventSource` (SSE).

Angular 22 richiede Node `^22.22.3`, `^24.15.0` o `^26`. Usiamo **Node 24 LTS**.

## Conseguenze

- Il contratto tra frontend e backend è unico e verificabile.
- Serve un Node recente in sviluppo e in CI.
