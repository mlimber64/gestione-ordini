# ADR 0017: Immagini Docker pubblicate su GHCR

- Stato: accettata
- Data: 2026-10-22

## Contesto

Per provare l'applicazione bisognava costruire le tre immagini sul proprio computer: il build di order-service e notification-service scarica Maven, compila e impacchetta, e richiede qualche minuto. Chi valuta il progetto vuole vederlo girare subito.

## Decisione

**Un workflow dedicato** (`.github/workflows/release-images.yml`) costruisce e pubblica le tre immagini nel registro di GitHub (`ghcr.io/mlimber64/gestione-ordini/order-service`, `…/notification-service` e `…/web`) quando si crea un tag `v*`. Da `v1.2.3` nascono i tag `1.2.3`, `1.2` e `latest`; `latest` non si assegna alle versioni di prova (`v1.2.3-rc1`). Le immagini portano le etichette OCI, compreso il collegamento al repository.

**Accesso con il token del workflow.** Il job usa `GITHUB_TOKEN` con il solo permesso `packages: write`, limitato a questo job: nessun segreto in più da gestire.

**Provare il flusso senza pubblicare.** Se in un pull request cambia il workflow stesso, le immagini vengono costruite ma non pubblicate: un errore si vede prima di creare una versione, non durante.

**Un compose che le usa.** `deploy/docker-compose.ghcr.yml` sovrascrive le tre immagini del compose principale: toglie la sezione `build`, fissa l'immagine pubblicata e forza il download. La versione si sceglie con `GESTIONE_ORDINI_VERSION` (di base `latest`). La CI controlla che il file resti valido.

## Conseguenze

- Le immagini esistono solo dalla prima versione creata dopo questa modifica: fino ad allora il compose con `ghcr` non trova nulla da scaricare.
- Solo `linux/amd64`. Su un Mac con processore Apple le immagini girano emulate, più lente. L'arm64 richiederebbe un runner arm nativo (la compilazione Java sotto emulazione è lenta e fragile) e un manifest unico: si rimanda finché serve.
- Dopo la prima pubblicazione va controllata la visibilità dei pacchetti nelle impostazioni di GitHub: devono essere pubblici perché chiunque possa scaricarli senza accedere.
- Le immagini non sono firmate; l'attestazione di provenienza di Docker Buildx è quella predefinita.
- Il compose con `ghcr` usa `!reset`, quindi serve Docker Compose 2.24 o successivo.
