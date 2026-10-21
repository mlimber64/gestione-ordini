-- M1: identità, clienti, indirizzi, categorie e prodotti.
-- I vincoli di formato (partita IVA, CAP, provincia) vivono nel database oltre che nella validazione dell'API.

CREATE TABLE app_user (
    id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    username      varchar(50)  NOT NULL UNIQUE,
    password_hash varchar(100) NOT NULL,
    role          varchar(20)  NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR', 'VIEWER')),
    enabled       boolean      NOT NULL DEFAULT true,
    created_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE SEQUENCE customer_code_seq START WITH 1;

CREATE TABLE customer (
    id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    code       varchar(20)  NOT NULL UNIQUE,
    name       varchar(150) NOT NULL,
    email      varchar(160) NOT NULL UNIQUE,
    phone      varchar(30),
    vat_number varchar(11)  UNIQUE CHECK (vat_number ~ '^[0-9]{11}$'),
    tax_code   varchar(16)  CHECK (tax_code ~ '^([A-Z0-9]{16}|[0-9]{11})$'),
    status     varchar(10)  NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BLOCKED')),
    created_at timestamptz  NOT NULL DEFAULT now(),
    updated_at timestamptz  NOT NULL DEFAULT now(),
    version    bigint       NOT NULL DEFAULT 0
);

CREATE TABLE address (
    id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id uuid         NOT NULL REFERENCES customer (id) ON DELETE CASCADE,
    type        varchar(10)  NOT NULL CHECK (type IN ('BILLING', 'SHIPPING')),
    street      varchar(200) NOT NULL,
    city        varchar(100) NOT NULL,
    province    varchar(2)   NOT NULL CHECK (province ~ '^[A-Z]{2}$'),
    postal_code varchar(5)   NOT NULL CHECK (postal_code ~ '^[0-9]{5}$'),
    country     varchar(2)   NOT NULL DEFAULT 'IT' CHECK (country ~ '^[A-Z]{2}$'),
    is_default  boolean      NOT NULL DEFAULT false
);

CREATE INDEX ix_address_customer ON address (customer_id);
-- Un solo indirizzo predefinito per cliente e per tipo
CREATE UNIQUE INDEX ux_address_default_per_type ON address (customer_id, type) WHERE is_default;

CREATE TABLE category (
    id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name      varchar(80) NOT NULL UNIQUE,
    parent_id uuid        REFERENCES category (id)
);

CREATE TABLE product (
    id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
    sku         varchar(40)   NOT NULL UNIQUE,
    name        varchar(150)  NOT NULL,
    description text,
    category_id uuid          NOT NULL REFERENCES category (id),
    unit_price  numeric(12,2) NOT NULL CHECK (unit_price >= 0),
    vat_rate    numeric(4,2)  NOT NULL CHECK (vat_rate IN (22.00, 10.00, 4.00)),
    active      boolean       NOT NULL DEFAULT true,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),
    version     bigint        NOT NULL DEFAULT 0
);

CREATE INDEX ix_product_category ON product (category_id);
CREATE INDEX ix_product_name_lower ON product (lower(name));
