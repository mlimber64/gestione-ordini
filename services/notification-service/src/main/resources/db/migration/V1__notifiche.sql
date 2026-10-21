-- M4: notifiche ricevute dagli eventi di order-service.
-- event_id è UNIQUE: è ciò che rende il consumer idempotente (Kafka consegna "almeno una volta").

CREATE TABLE notification_event (
    id           bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id     uuid         NOT NULL UNIQUE,
    event_type   varchar(60)  NOT NULL,
    topic        varchar(120) NOT NULL,
    aggregate_id varchar(64)  NOT NULL,
    severity     varchar(10)  NOT NULL CHECK (severity IN ('INFO', 'WARNING')),
    title        varchar(200) NOT NULL,
    message      varchar(500) NOT NULL,
    data         jsonb        NOT NULL,
    occurred_at  timestamptz  NOT NULL,
    received_at  timestamptz  NOT NULL DEFAULT now()
);

-- L'id cresce con l'ordine di arrivo: serve come identificativo SSE (Last-Event-ID) per riprendere dopo una disconnessione
CREATE INDEX ix_notification_event_aggregate ON notification_event (aggregate_id);
