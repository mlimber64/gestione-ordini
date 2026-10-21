-- M3: transactional outbox. Gli eventi si scrivono nella stessa transazione del cambiamento che li genera
-- e un processo a parte li pubblica su Kafka: o succedono entrambe le cose, o nessuna.

CREATE TABLE outbox_event (
    id             uuid         PRIMARY KEY,
    aggregate_type varchar(30)  NOT NULL,
    aggregate_id   varchar(64)  NOT NULL,
    event_type     varchar(60)  NOT NULL,
    topic          varchar(120) NOT NULL,
    payload        jsonb        NOT NULL,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    published_at   timestamptz,
    attempts       integer      NOT NULL DEFAULT 0,
    last_error     varchar(500)
);

-- Indici parziali: il relay guarda solo gli eventi da pubblicare, la pulizia solo quelli già pubblicati
CREATE INDEX ix_outbox_pending ON outbox_event (created_at, id) WHERE published_at IS NULL;
CREATE INDEX ix_outbox_published ON outbox_event (published_at) WHERE published_at IS NOT NULL;
