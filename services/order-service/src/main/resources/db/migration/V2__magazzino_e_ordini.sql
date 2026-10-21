-- M2: magazzino (giacenze e movimenti) e ordini (testata, righe, storico degli stati).
-- Le regole che non devono mai essere violate, nemmeno da un bug applicativo, vivono anche qui come vincoli CHECK.

CREATE TABLE inventory (
    product_id    uuid        PRIMARY KEY REFERENCES product (id),
    on_hand       integer     NOT NULL DEFAULT 0 CHECK (on_hand >= 0),
    reserved      integer     NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    reorder_level integer     NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    -- Non si può riservare più di quanto è fisicamente in magazzino
    CONSTRAINT ck_inventory_reserved_le_on_hand CHECK (reserved <= on_hand)
);

CREATE TABLE stock_movement (
    id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id     uuid        NOT NULL REFERENCES product (id),
    type           varchar(15) NOT NULL CHECK (type IN ('RECEIPT', 'ADJUSTMENT', 'RESERVATION', 'RELEASE', 'SHIPMENT')),
    quantity       integer     NOT NULL CHECK (quantity <> 0),
    reference_type varchar(20),
    reference_id   uuid,
    note           varchar(300),
    created_by     varchar(50) NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_stock_movement_product ON stock_movement (product_id, created_at DESC);

CREATE SEQUENCE order_number_seq START WITH 1;

CREATE TABLE sales_order (
    id               uuid          PRIMARY KEY,
    number           varchar(20)   NOT NULL UNIQUE,
    customer_id      uuid          NOT NULL REFERENCES customer (id),
    -- Copia dei dati del cliente e dell'indirizzo al momento dell'ordine: lo storico non cambia se l'anagrafica cambia
    customer_code    varchar(20)   NOT NULL,
    customer_name    varchar(150)  NOT NULL,
    ship_street      varchar(200)  NOT NULL,
    ship_city        varchar(100)  NOT NULL,
    ship_province    varchar(2)    NOT NULL,
    ship_postal_code varchar(5)    NOT NULL,
    ship_country     varchar(2)    NOT NULL,
    status           varchar(10)   NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
    notes            varchar(500),
    total_net        numeric(14,2) NOT NULL CHECK (total_net >= 0),
    total_vat        numeric(14,2) NOT NULL CHECK (total_vat >= 0),
    total_gross      numeric(14,2) NOT NULL CHECK (total_gross >= 0),
    created_by       varchar(50)   NOT NULL,
    created_at       timestamptz   NOT NULL DEFAULT now(),
    updated_at       timestamptz   NOT NULL DEFAULT now(),
    version          bigint        NOT NULL DEFAULT 0
);

CREATE INDEX ix_sales_order_customer ON sales_order (customer_id);
CREATE INDEX ix_sales_order_status_created ON sales_order (status, created_at DESC);

CREATE TABLE order_item (
    id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id     uuid          NOT NULL REFERENCES sales_order (id) ON DELETE CASCADE,
    product_id   uuid          NOT NULL REFERENCES product (id),
    -- Codice, nome e prezzo sono una copia: il listino può cambiare, l'ordine no
    sku          varchar(40)   NOT NULL,
    product_name varchar(150)  NOT NULL,
    quantity     integer       NOT NULL CHECK (quantity > 0),
    unit_price   numeric(12,2) NOT NULL CHECK (unit_price >= 0),
    vat_rate     numeric(4,2)  NOT NULL,
    line_net     numeric(14,2) NOT NULL,
    line_vat     numeric(14,2) NOT NULL,
    CONSTRAINT ux_order_item_product UNIQUE (order_id, product_id)
);

CREATE INDEX ix_order_item_product ON order_item (product_id);

CREATE TABLE order_status_history (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id    uuid        NOT NULL REFERENCES sales_order (id) ON DELETE CASCADE,
    from_status varchar(10),
    to_status   varchar(10) NOT NULL,
    reason      varchar(300),
    changed_by  varchar(50) NOT NULL,
    changed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_order_status_history_order ON order_status_history (order_id, changed_at);
