# ADR 0019: CDC con Debezium al posto del polling dell'outbox

- Stato: accettata
- Data: 2026-10-22

## Contesto

Il relay dell'outbox (ADR 0011) interroga la tabella `outbox_event` ogni secondo: una query anche quando non c'è nulla da pubblicare e fino a un secondo di ritardo. A questa scala va bene, ma con volumi alti si preferisce leggere il log di PostgreSQL (CDC, *change data capture*), che avvisa quando una riga viene scritta senza interrogare nessuno.

## Decisione

**Debezium legge il log e porta gli eventi a Kafka, in alternativa al polling.** Il polling resta il comportamento di base: l'avvio è leggero e non serve nulla in più. Il CDC si attiva con un compose aggiuntivo:

```bash
docker compose -f deploy/docker-compose.yml -f deploy/docker-compose.cdc.yml --profile app up -d --build
```

È un file a parte e non un profilo perché il cambio deve avvenire **tutto insieme**: con il relay e Debezium attivi nello stesso momento ogni evento arriverebbe due volte. Il file cambia tre cose: PostgreSQL scrive il log in forma logica (`wal_level=logical`), parte Kafka Connect con il connettore dell'outbox e order-service passa a `app.outbox.mode=cdc`, senza relay.

**Nulla cambia per chi consuma.** La tabella è la stessa e l'`EventRouter` di Debezium produce lo stesso messaggio: topic dalla colonna `topic`, chiave da `aggregate_id` (stesso ordine per entità), corpo uguale alla busta JSON e intestazioni `event-id` ed `event-type`. notification-service non sa quale dei due meccanismi gira. Le intestazioni di contesto di Debezium (`__debezium.context.*`) sono disattivate perché il contratto non le prevede. Resta una intestazione `id` in più che l'`EventRouter` aggiunge sempre, innocua.

**Immagine allineata a Kafka.** `debezium/connect:3.7.0.Final` include Kafka Connect 4.3.1, la stessa versione del broker, e il connettore di PostgreSQL. L'API REST di Connect (porta 8083) non ha autenticazione: si pubblica solo su `127.0.0.1`.

**Che cosa fa l'applicazione in modalità `cdc`.** Scrive l'evento nella transazione, come prima, e non tocca più la tabella: niente relay, niente `published_at`. La pulizia notturna (ora una classe a parte, `OutboxCleanup`) toglie gli eventi vecchi di sette giorni in base a `created_at` invece che a `published_at`; le `DELETE` finiscono nel log ma l'`EventRouter` le ignora. La metrica `outbox.events.pending` esiste solo con il polling: in CDC il ritardo si vede nello stato del connettore.

**Dal polling al CDC senza perdere eventi.** Al primo avvio il connettore fa uno *snapshot* che legge solo le righe con `published_at IS NULL`, cioè gli eventi che il relay non aveva ancora pubblicato. Quelli già inviati non si ripetono.

**Verifica.** Il job `e2e` della CI gira ora in entrambi i modi e, in `cdc`, aspetta anche che il connettore sia in esecuzione. Oltre a questo ho provato a mano: (1) il messaggio arriva con chiave, intestazioni e busta giuste; (2) con Kafka Connect fermo l'ordine si crea lo stesso, l'evento aspetta nella tabella e dopo il riavvio arriva **una sola volta**, con la sua notifica; (3) lo snapshot esporta solo i due eventi pendenti e non quello già pubblicato; (4) il ritorno al polling funziona.

## Tornare al polling

Non basta togliere il file: il connettore va rimosso e il database ripulito, altrimenti lo slot di replicazione trattiene il log all'infinito (il disco cresce) e il relay reinvierebbe come «da pubblicare» tutti gli eventi che Debezium ha già consegnato.

```bash
curl -X DELETE http://localhost:8083/connectors/outbox
docker exec gestione-ordini-postgres psql -U ordini -d gestione_ordini -c \
  "SELECT pg_drop_replication_slot('gestione_ordini_outbox'); DROP PUBLICATION IF EXISTS gestione_ordini_outbox;"
docker exec gestione-ordini-postgres psql -U ordini -d gestione_ordini -c \
  "UPDATE orders.outbox_event SET published_at = now() WHERE published_at IS NULL;"
docker compose -f deploy/docker-compose.yml --profile app up -d --remove-orphans
```

Il terzo comando dà per consegnato tutto ciò che c'è: va eseguito solo dopo aver controllato che Debezium non abbia ritardi.

## Conseguenze

- **È un componente in più da far funzionare**: Kafka Connect (circa mezzo gigabyte di memoria in più) e un connettore da tenere d'occhio. Per questo non è il comportamento di base.
- **Lo slot di replicazione è un rischio operativo.** Se il connettore resta fermo a lungo, PostgreSQL conserva il log finché non viene letto. In produzione serve un allarme sul ritardo dello slot (`pg_replication_slots`) e un limite (`max_slot_wal_keep_size`). Il `heartbeat` (10 s) fa avanzare lo slot anche quando l'outbox è ferma ma il resto del database no.
- **Almeno una volta, come prima.** Dopo un riavvio Debezium può reinviare qualche evento: i consumer, che scartano i duplicati per `eventId`, lo gestiscono (ADR 0012).
- **Se il connettore viene ricreato da zero** (offset persi) lo snapshot rilegge tutti gli eventi con `published_at IS NULL`, che in modalità `cdc` sono tutti quelli degli ultimi sette giorni: arrivano duplicati, tutti scartati dai consumer.
- **Due connettori con lo stesso `topic.prefix` si disturbano**: Debezium aspetta un minuto per registrare le metriche JMX. Qui c'è un solo connettore.
- **Utente del database.** Nel compose Debezium usa l'utente del database, che ha ogni privilegio. In produzione servono un utente dedicato con il permesso `REPLICATION` e una pubblicazione creata in anticipo (`publication.autocreate.mode=disabled`).
- **Un solo nodo Connect e nessuna replica** (un solo broker): è un ambiente di prova, non un'architettura di produzione.
