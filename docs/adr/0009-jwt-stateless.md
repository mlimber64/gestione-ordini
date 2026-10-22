# ADR 0009: Autenticazione JWT stateless con token di accesso e di refresh

- Stato: accettata
- Data: 2026-10-21

## Contesto

L'API deve essere protetta e scalabile senza sessioni lato server, e deve distinguere i permessi per ruolo (ADMIN, OPERATOR, VIEWER).

## Decisione

- **order-service** emette e verifica i propri JWT firmati con HS256 (Spring Security come resource server).
- Il **token di accesso** dura 15 minuti. Il **token di refresh** dura 7 giorni e viaggia in un cookie `HttpOnly` (ADR 0020).
- Ogni token porta il claim `token_use` (`access` o `refresh`): un token di refresh non è accettato come accesso e viceversa.
- I ruoli viaggiano nel claim `roles` e i permessi si dichiarano con `@PreAuthorize` sui controller.
- Le password sono salvate con BCrypt. Il segreto di firma arriva da `JWT_SECRET`: senza almeno 32 byte l'applicazione non parte.

## Conseguenze

- Nessuna sessione da condividere tra istanze.
- Un token non si può revocare prima della scadenza: un utente disabilitato perde l'accesso solo al prossimo refresh. È un limite accettato per questo progetto.
- Il segreto condiviso (HS256) va protetto. In un ambiente reale si passerebbe a un identity provider (per esempio Keycloak) con firma asimmetrica.
