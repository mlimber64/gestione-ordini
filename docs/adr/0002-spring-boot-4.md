# ADR 0002: Spring Boot 4.1

- Stato: accettata
- Data: 2026-10-21

## Contesto

Un progetto nuovo deve partire dalla linea corrente di Spring Boot, non da una in chiusura di supporto.

## Decisione

Usiamo **Spring Boot 4.1.x** (Spring Framework 7), generato da start.spring.io, con Maven.

## Conseguenze

- Si parte dalla linea attuale e si evitano migrazioni immediate.
- Alcune librerie di terze parti possono non essere ancora allineate: in quel caso si valuta caso per caso.
- Dependabot mantiene aggiornate le versioni minori e di patch.
