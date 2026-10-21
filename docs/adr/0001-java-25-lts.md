# ADR 0001: Java 25 (LTS)

- Stato: accettata
- Data: 2026-10-21

## Contesto

Serve una versione di Java per i due servizi backend. Le opzioni realistiche sono Java 17, 21 e 25.

## Decisione

Usiamo **Java 25 (Temurin)**, l'ultima versione LTS.

## Conseguenze

- Spring Boot 4 richiede almeno Java 17 e supporta Java 25, quindi tornare a una versione precedente è semplice se un ambiente lo richiede.
- I thread virtuali sono maturi e permettono di usare Spring MVC con alta concorrenza.
- Chi sviluppa deve avere il JDK 25 e impostare `JAVA_HOME`.
