# ADR 0016: Conservazione delle notifiche

- Stato: accettata
- Data: 2026-10-22

## Contesto

`notification_event` riceve una riga per ogni evento Kafka e non veniva mai svuotata: la tabella cresceva senza limite. L'outbox di order-service ha già una pulizia notturna (eventi pubblicati da più di 7 giorni) e la stessa idea vale qui.

C'è però una differenza. L'idempotenza del consumer (ADR 0012) si regge sul vincolo `UNIQUE` su `event_id`: un evento consegnato due volte non crea due notifiche perché la seconda riga viene rifiutata. Se cancelliamo la notifica mentre Kafka può ancora rileggere il suo evento, la rilettura (nuovo gruppo di consumer, azzeramento degli offset, `auto-offset-reset: earliest`) ricreerebbe la notifica come se fosse nuova.

## Decisione

**Pulizia notturna** (`NotificationRetention`, alle 03:45) che elimina le notifiche con `received_at` più vecchio del periodo di conservazione e scrive nel log quante ne ha tolte. Orario e periodo si cambiano con `app.notifications.cleanup-cron` e `app.notifications.retention`.

**30 giorni di base, non 7.** Kafka conserva i messaggi 7 giorni di base: finché una notifica vive più a lungo del suo evento, quell'evento non può più essere riletto e il vincolo `UNIQUE` non serve più. Con 7 giorni i due periodi coinciderebbero e ai margini si potrebbero creare duplicati; 30 lasciano un ampio margine e la cronologia consultabile resta utile. Il servizio rifiuta un periodo nullo o negativo all'avvio.

**Compito reattivo.** In notification-service (WebFlux) il metodo programmato restituisce un `Mono` e Spring lo sottoscrive: nessun thread bloccato. Un errore si registra e non ferma le esecuzioni successive.

## Conseguenze

- Se si porta la conservazione di Kafka oltre i 30 giorni, va alzato anche `app.notifications.retention`: la regola è «le notifiche vivono più a lungo dei loro eventi».
- Un client che si ricollega con un `Last-Event-ID` più vecchio del periodo perde le notifiche già cancellate; l'interfaccia mostra comunque la cronologia rimasta.
- Con più repliche del servizio ogni replica esegue la pulizia: è una `DELETE` idempotente, quindi innocua, ma ridondante. Un lock distribuito sarebbe eccessivo per questo carico.
- Non c'è un archivio: ciò che si elimina non si recupera. Per conservare di più basta alzare il periodo.
