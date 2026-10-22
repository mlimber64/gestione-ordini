# ADR 0015: HTTPS e HTTP/2 davanti al frontend

- Stato: accettata
- Data: 2026-10-22

## Contesto

Ogni scheda dell'applicazione tiene aperto uno stream SSE verso notification-service (ADR 0012). Con HTTP/1.1 un browser apre al massimo circa sei connessioni per origine, e uno stream SSE ne occupa una per tutta la durata: dalla settima scheda in poi lo stream non si collega e perfino le normali richieste restano in coda. Lo avevamo annotato come limite nell'ADR 0014.

HTTP/2 risolve il problema perché porta tutte le richieste e gli stream su una sola connessione. Ma i browser lo usano solo sopra TLS: HTTP/2 «in chiaro» non esiste per loro. Serve quindi HTTPS.

## Decisione

**nginx ascolta anche sulla porta 443 con `http2 on`**, pubblicata dal compose come `8443` (`WEB_TLS_PORT`). La porta 80 (`8080`) resta in HTTP, invariata: il resto della documentazione, il seed e i test di base continuano a funzionare come prima. La configurazione comune (rotte, intestazioni di sicurezza, proxy) sta in un solo file incluso dai due server, così non si duplica.

**Certificato autofirmato creato all'avvio del container**, da uno script in `docker-entrypoint.d`, valido per `localhost`. La chiave nasce nel container e non finisce mai nell'immagine né nel repository. Chi ha un certificato vero lo monta in `/etc/nginx/certs` (`tls.crt` e `tls.key`) e lo script non fa nulla. Il prezzo è che il browser avvisa che il certificato non è attendibile: è accettabile per una demo locale, non per la produzione.

**Verifica con un browser vero.** Un test Playwright (`e2e/tests/http2.spec.ts`) apre otto schede nello stesso browser, accede in ciascuna e controlla che tutte mostrino «In diretta»; un secondo controlla che il protocollo negoziato sia `h2`. Lo stesso test lanciato contro la porta HTTP/1.1 fallisce (le schede oltre il limite restano senza stream), quindi prova davvero quello che dice.

## Conseguenze

- In produzione HTTPS si termina su un reverse proxy o un bilanciatore con un certificato vero; questa configurazione mostra solo che il frontend si comporta bene con HTTP/2.
- Il certificato autofirmato dura 365 giorni e si rigenera a ogni nuovo container.
- Non ho aggiunto HSTS né il reindirizzamento da HTTP a HTTPS: con un certificato autofirmato renderebbero l'indirizzo `localhost` inutilizzabile dopo la prima visita.
- Nel compose c'è una porta in più da liberare (`8443`).
