# ADR 0006: Architettura esagonale per funzionalità

- Stato: accettata
- Data: 2026-10-21

## Contesto

L'architettura a livelli classica (controller, service, repository) lega tutto a Spring e a JPA e rende difficile testare le regole di business.

## Decisione

**order-service** usa l'architettura esagonale (porte e adattatori), con i pacchetti divisi **per funzionalità**: identity, customer, catalog, inventory, order. Ogni funzionalità contiene `domain`, `application` e `adapter`.

Le dipendenze vanno sempre verso il dominio. La regola è verificata con ArchUnit.

Per pragmatismo:
- **Ordini e magazzino** hanno un dominio ricco, separato dalle entità JPA.
- **Clienti, categorie e prodotti** sono CRUD semplici e usano direttamente l'entità JPA nell'adattatore.

**notification-service** ha una struttura più semplice, perché non ha un dominio proprio.

## Conseguenze

- Le regole di business si testano senza database né Spring.
- C'è più codice di mappatura nelle parti con dominio ricco, in cambio di chiarezza.
