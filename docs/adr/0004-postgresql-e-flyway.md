# ADR 0004: PostgreSQL 18 e Flyway

- Stato: accettata
- Data: 2026-10-21

## Contesto

Servono un database relazionale affidabile, tipi come `jsonb` per l'outbox e migrazioni ripetibili.

## Decisione

- **PostgreSQL 18**, con un database e due schemi: `orders` e `notifications`.
- **Flyway** per versionare lo schema nel repository. `ddl-auto` resta su `validate`.
- Ogni servizio gestisce solo il proprio schema.

## Conseguenze

- Lo schema è riproducibile in CI e in locale.
- I test di integrazione usano un PostgreSQL reale con Testcontainers, non un database in memoria.
- I due servizi non condividono tabelle: comunicano solo tramite eventi.
