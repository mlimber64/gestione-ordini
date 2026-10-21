# ADR 0011: Transactional outbox e contratto degli eventi

- Stato: accettata
- Data: 2026-10-21

## Contesto

Quando un ordine cambia, altri servizi devono saperlo. Pubblicare su Kafka direttamente dentro il caso d'uso ha un difetto di fondo: database e Kafka non condividono una transazione. Se il database conferma e Kafka è giù, l'evento si perde; se Kafka riceve l'evento e il database annulla, si annuncia qualcosa che non è mai successo.

## Decisione

**Transactional outbox.** L'evento si scrive nella tabella `outbox_event` nella stessa transazione del cambiamento. Un relay (`OutboxRelay`) legge gli eventi non pubblicati e li invia a Kafka. Il database è l'unica fonte di verità: o esistono il cambiamento e il suo evento, o nessuno dei due. `OutboxPublisher` richiede una transazione già aperta e fallisce se manca.

**Garanzia "almeno una volta".** L'evento si segna come pubblicato solo dopo la conferma di Kafka (`acks=all`, producer idempotente). Se il servizio cade tra l'invio e il segno, l'evento si reinvia. I consumer devono quindi scartare i duplicati usando l'`eventId`.

**Relay sicuro con più istanze.** La lettura usa `FOR UPDATE SKIP LOCKED`: due istanze non pubblicano lo stesso evento né si bloccano. Al primo errore il lotto si ferma, così un evento non supera quelli che lo precedono.

**Ordine per entità.** La chiave Kafka è l'identificativo dell'entità: gli eventi dello stesso ordine finiscono nella stessa partizione e arrivano in ordine.

**Contratto.** Ogni messaggio è una busta JSON `{ eventId, eventType, occurredAt, data }`. `eventId` ed `eventType` viaggiano anche come intestazioni (`event-id`, `event-type`). Nome del topic: `dominio.evento.versione`.

| Topic | Evento | Quando |
|---|---|---|
| `orders.order-created.v1` | `OrderCreated` | alla creazione di un ordine |
| `orders.order-status-changed.v1` | `OrderStatusChanged` | a ogni cambio di stato |
| `inventory.stock-low.v1` | `StockLow` | quando il disponibile scende alla soglia di riordino, una sola volta per passaggio |

**Evoluzione.** Si possono aggiungere campi; non si tolgono né si cambiano di significato. Una modifica incompatibile richiede un nuovo topic con versione successiva.

**Pulizia.** Gli eventi pubblicati da più di sette giorni si eliminano ogni notte.

## Conseguenze

- Se Kafka è irraggiungibile, gli ordini continuano a funzionare: gli eventi si accumulano e partono al ritorno. Il contatore `outbox.events.pending` lo rende visibile in Prometheus.
- Gli eventi arrivano con un piccolo ritardo (intervallo di polling, un secondo di default).
- Il polling costa una query a vuoto al secondo; è accettabile a questa scala. Con volumi molto più alti si passerebbe a CDC (per esempio Debezium).
