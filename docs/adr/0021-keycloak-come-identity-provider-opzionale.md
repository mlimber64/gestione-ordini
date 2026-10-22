# ADR 0021: Keycloak come identity provider opzionale (OpenID Connect)

- Stato: accettata (integra l'ADR 0009, che resta valido per la modalità di base)
- Data: 2026-10-22

## Contesto

Con il login interno (ADR 0009) order-service emette i token e ne firma la validità con un segreto condiviso (HS256): chiunque lo conosca, compreso notification-service, potrebbe anche *emettere* token validi. Gli utenti vivono in una tabella nostra, senza recupero della password, senza blocco dopo i tentativi falliti e senza accesso unico. In un ambiente reale tutto questo lo fa un identity provider; l'ADR 0009 lo indicava come passo successivo.

## Decisione

**Keycloak è un'alternativa, non un sostituto.** `app.auth.mode` (`AUTH_MODE`) vale `local` di base (invariato: si prova tutto con `docker compose --profile app up`) oppure `oidc`. Come per il CDC (ADR 0019), la seconda si attiva con un file compose a parte, `deploy/docker-compose.keycloak.yml`, che porta insieme Keycloak 26 e i due servizi in modalità `oidc`.

**Accesso con Authorization Code e PKCE, sulla pagina di Keycloak.** L'utente digita la password solo nella pagina di Keycloak: l'applicazione non la vede mai (niente *password grant*). order-service fa da «backend dell'interfaccia»:

1. `GET /api/v1/auth/oidc/login` genera `state` e la verifica PKCE (S256), le ricorda in un cookie breve (`HttpOnly`, `SameSite=Lax`, 5 minuti) e manda il browser a Keycloak.
2. `GET /api/v1/auth/oidc/callback` controlla lo `state`, scambia il codice con i token usando il segreto del client (che il browser non vede) e mette il token di refresh nel cookie `HttpOnly` dell'ADR 0020.
3. `refresh` e `logout` parlano con Keycloak al posto nostro; il logout chiude anche la sessione presso Keycloak, altrimenti il prossimo accesso entrerebbe senza chiedere nulla.

Il browser continua a ricevere solo il token di accesso, in memoria: l'interfaccia cambia soltanto nel pulsante «Accedi con Keycloak» al posto del modulo (`GET /api/v1/auth/config` dice quale mostrare).

**I servizi verificano con le chiavi pubbliche.** order-service e notification-service scaricano il JWKS del realm (RS256) e controllano la firma, l'emittente, la scadenza e `typ=Bearer`: Keycloak firma con la stessa chiave anche i token di refresh, che non devono valere come accesso. Nessuno dei due ha più un segreto con cui falsificare un token. Le chiavi si scaricano al primo uso, quindi i servizi partono anche prima di Keycloak.

**Ruoli.** I ruoli di realm `ADMIN`, `OPERATOR` e `VIEWER` arrivano nel claim `roles` (un *protocol mapper* del client): i controlli `@PreAuthorize` non cambiano. Il realm di prova (`deploy/keycloak/realm-gestione-ordini.json`) contiene tre utenti, `admin`, `operatore` e `lettore`.

**Keycloak dietro nginx, su `/auth`.** Stessa origine dell'applicazione: niente CORS e un solo indirizzo per il browser. L'indirizzo pubblico è fisso (`KC_HOSTNAME`, è quello che compare in `iss`) e le chiamate tra servizi usano `http://keycloak:8080` (backchannel dinamico). nginx risolve `keycloak` a ogni richiesta, quindi parte anche senza; la location usa `^~` (altrimenti la regola sui `.js` intercetterebbe i file di Keycloak) e non eredita la CSP stretta dell'applicazione, perché la pagina di Keycloak manda la sua.

**Cosa non c'è in modalità `oidc`.** `POST /auth/login`, la gestione utenti (`/api/v1/users`) e l'amministratore iniziale: gli utenti si gestiscono in Keycloak.

## Alternative scartate

- **Il modulo di login dell'applicazione con *password grant*:** l'applicazione tornerebbe a vedere le password, il flusso è deprecato (OAuth 2.1) e si perdono recupero password e accesso unico.
- **Il flusso gestito nel browser (un client OIDC in Angular):** il token di refresh finirebbe di nuovo dove lo legge uno script; il cookie `HttpOnly` dell'ADR 0020 sarebbe superfluo.
- **Spring Security `oauth2Login` con sessione lato server:** funziona, ma riporterebbe le sessioni (e la loro replica tra istanze) che l'API stateless evita.

## Conseguenze

- Un secondo modo di autenticare raddoppia i percorsi da provare: il job `e2e` della CI gira anche con `oidc` (Playwright contro un Keycloak vero) e `OidcAuthIntegrationTest` copre il flusso contro un provider finto (PKCE, `state`, cookie, rifiuto di token con chiave, emittente o `typ` sbagliati, ruoli).
- Il realm contiene un client in più, `gestione-ordini-e2e`, che ammette il *password grant*: serve ai test e a `seed.mjs` per preparare i dati via API. **Va tolto in qualunque uso reale**, insieme al segreto del client e alle password di prova del realm. Le API accettano i token di qualsiasi client del realm (non si controlla `azp`).
- Keycloak parte in modalità di sviluppo (`start-dev`: database interno, senza HTTPS): è una dimostrazione dell'integrazione, non una configurazione di produzione.
- Il login con Keycloak si fa dall'indirizzo pubblico del realm (porta `WEB_PORT`, 8080 di base). L'applicazione risponde anche su 8443, e l'URI di ritorno ne segue la porta (è registrato nel realm), ma la pagina di accesso resta su 8080. Cambiando porta vanno aggiornati gli URI del client nel realm.
- Un token di accesso non si revoca prima della scadenza (15 minuti, come prima); un utente disabilitato in Keycloak perde l'accesso al prossimo refresh.
- Si passa da modalità senza migrare: gli utenti locali e quelli di Keycloak sono insiemi separati. I dati (ordini, clienti…) non dipendono dall'identità.
