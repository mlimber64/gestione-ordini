-- Pagamenti: registrati a mano da un operatore (bonifico, carta, contrassegno) e collegati a un ordine.
-- Il pagamento è un dato a parte: non cambia lo stato dell'ordine. Ogni ordine può avere più pagamenti (acconti, saldo).

CREATE TABLE payment (
    id         uuid          PRIMARY KEY,
    order_id   uuid          NOT NULL REFERENCES sales_order (id),
    method     varchar(20)   NOT NULL CHECK (method IN ('BANK_TRANSFER', 'CARD', 'CASH_ON_DELIVERY')),
    status     varchar(10)   NOT NULL CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    amount     numeric(14,2) NOT NULL CHECK (amount > 0),
    reference  varchar(100),
    created_by varchar(50)   NOT NULL,
    created_at timestamptz   NOT NULL DEFAULT now(),
    updated_by varchar(50)   NOT NULL,
    updated_at timestamptz   NOT NULL DEFAULT now(),
    paid_at    timestamptz,
    version    bigint        NOT NULL DEFAULT 0,
    -- Un pagamento incassato (o poi rimborsato) ha sempre la data dell'incasso; gli altri no
    CONSTRAINT ck_payment_paid_at CHECK ((status IN ('PAID', 'REFUNDED')) = (paid_at IS NOT NULL))
);

CREATE INDEX ix_payment_order ON payment (order_id, created_at);
