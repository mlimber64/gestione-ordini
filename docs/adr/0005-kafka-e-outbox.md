# ADR 0005: Apache Kafka con transactional outbox

- Stato: accettata
- Data: 2026-10-21

## Contesto

Quando un ordine viene creato, il database e Kafka devono restare coerenti. Scrivere su entrambi in due passaggi può lasciare un ordine senza evento.

## Decisione

- Usiamo **Apache Kafka 4 in modalità KRaft**, senza ZooKeeper.
- L'evento viene salvato nella tabella `outbox_event` **nella stessa transazione** dell'ordine. Un relay lo pubblica poi su Kafka.
- La consegna è **almeno una volta**: il consumer è idempotente grazie all'`eventId`.
- Chiave dei messaggi: l'id dell'ordine, per mantenere l'ordine degli eventi. Gli errori finiscono in un dead-letter topic.

## Conseguenze

- Nessun ordine viene perso o pubblicato senza essere stato salvato.
- Il relay aggiunge un componente da monitorare.
- I nomi dei topic includono la versione (`.v1`) per evolvere il contratto.
