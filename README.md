# Gestione Ordini

[![CI](https://github.com/mlimber64/gestione-ordini/actions/workflows/ci.yml/badge.svg)](https://github.com/mlimber64/gestione-ordini/actions/workflows/ci.yml)

Sistema di gestione degli ordini con architettura a microservizi: catalogo, magazzino e ordini con riserva atomica delle giacenze, eventi su Apache Kafka e notifiche in tempo reale.

Progetto di portafoglio, sviluppato in modo incrementale con milestone, pull request e decisioni documentate. **Stato: in sviluppo (M3 completata: eventi con outbox e Kafka).**

## Stack

| Livello | Tecnologia |
|---|---|
| Backend principale | Java 25, Spring Boot 4.1, Spring MVC con thread virtuali, JPA, Flyway |
| Backend reattivo | Spring WebFlux, R2DBC, Project Reactor |
| Frontend | Angular 22, TypeScript 6, Angular Material |
| Database | PostgreSQL 18 |
| Messaggistica | Apache Kafka 4 (KRaft) con pattern transactional outbox |
| Sicurezza | Spring Security, JWT |
| Qualità | JUnit, Testcontainers, JaCoCo, SonarCloud |
| Infrastruttura | Docker, Docker Compose, GitHub Actions |

## Architettura

```mermaid
flowchart LR
  U(["Operatore"]) --> W["Angular 22"]
  W -->|"REST + JWT"| O["order-service<br/>Spring MVC · JPA"]
  W -->|"SSE"| N["notification-service<br/>WebFlux · R2DBC"]
  O --> P1[("PostgreSQL 18<br/>schema orders")]
  O -->|"outbox"| K{{"Apache Kafka"}}
  K --> N
  N --> P2[("PostgreSQL 18<br/>schema notifications")]
```

- **order-service**: architettura esagonale, organizzata per funzionalità (identity, customer, catalog, inventory, order). Pubblica gli eventi tramite outbox.
- **notification-service**: servizio reattivo che consuma gli eventi in modo idempotente ed espone uno stream SSE.
- **web**: applicazione Angular con rotte caricate a richiesta.

Le decisioni principali sono documentate in [docs/adr](docs/adr).

## Avvio rapido

Prerequisiti: JDK 25, Node 24 LTS e Docker.

```bash
# Infrastruttura: PostgreSQL 18 e Kafka (porte 15432 e 19092)
docker compose -f deploy/docker-compose.yml up -d

# Servizi
cd services/order-service && ./mvnw spring-boot:run          # http://localhost:8081
cd services/notification-service && ./mvnw spring-boot:run   # http://localhost:8082

# Frontend
cd web && npm ci && npm start                                # http://localhost:4200
```

| Componente | Porta |
|---|---|
| PostgreSQL | 15432 |
| Kafka | 19092 |
| order-service | 8081 |
| notification-service | 8082 |
| web (sviluppo) | 4200 |

I test di integrazione usano Testcontainers: richiedono solo Docker in esecuzione.

### order-service in locale

Con il profilo `dev` (predefinito in locale) il servizio crea all'avvio l'utente `admin` con la password `admin-dev-1234`. Sono valori **solo per lo sviluppo**: in un ambiente reale vanno impostate le variabili qui sotto.

- API: `http://localhost:8081/api/v1`
- Documentazione interattiva: `http://localhost:8081/swagger-ui.html`
- Contratto OpenAPI: `http://localhost:8081/v3/api-docs`

```bash
# Login: restituisce accessToken e refreshToken
curl -X POST http://localhost:8081/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin-dev-1234"}'
```

| Variabile | Significato | Obbligatoria fuori da `dev` |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Profilo attivo | sì |
| `JWT_SECRET` | Segreto di firma dei JWT, almeno 32 byte | sì |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | Amministratore creato al primo avvio | `ADMIN_PASSWORD` sì |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | Connessione a PostgreSQL | no |
| `KAFKA_BOOTSTRAP_SERVERS` | Indirizzo di Kafka | no |

### Ordini e magazzino

```text
POST /api/v1/inventory/{productId}/receipts       carico merce
POST /api/v1/inventory/{productId}/adjustments    rettifica (anche negativa, con motivo)
GET  /api/v1/inventory?lowStock=true              prodotti sotto scorta
POST /api/v1/orders                               crea l'ordine e riserva la merce (409 se non basta)
POST /api/v1/orders/{id}/confirm | ship | deliver | cancel
GET  /api/v1/orders?status=&customerId=&from=&to= ricerca paginata
```

Il ciclo di vita è `PENDING → CONFIRMED → SHIPPED → DELIVERED`, con annullamento possibile prima della spedizione. La riserva è atomica anche con richieste simultanee: vedi [ADR 0010](docs/adr/0010-riserva-atomica-delle-giacenze.md).

### Eventi

Ogni cambiamento viene annunciato su Kafka con il pattern transactional outbox ([ADR 0011](docs/adr/0011-outbox-e-contratto-degli-eventi.md)): l'evento si salva nella stessa transazione del cambiamento, quindi non si perde nemmeno se Kafka è spento in quel momento.

| Topic | Evento |
|---|---|
| `orders.order-created.v1` | ordine creato |
| `orders.order-status-changed.v1` | cambio di stato (con stato precedente, nuovo e motivo) |
| `inventory.stock-low.v1` | prodotto sceso alla soglia di riordino |

Per vederli: `docker exec gestione-ordini-kafka /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic orders.order-created.v1 --from-beginning`

## Struttura

```
services/
  order-service/          Spring MVC, JPA, Flyway, outbox
  notification-service/   WebFlux, R2DBC, consumer Kafka, SSE
web/                      Angular 22
deploy/                   Docker Compose e configurazione dell'infrastruttura
docs/adr/                 Architecture Decision Record
.github/                  CI, template di issue e pull request, Dependabot
```

## Roadmap

- [x] **M0** Fondamenta: struttura, Compose, CI, ADR
- [x] **M1** Identità e catalogo: login JWT con ruoli, clienti e indirizzi, categorie, prodotti
- [x] **M2** Magazzino e ordini: riserva atomica, macchina a stati
- [x] **M3** Eventi: outbox e topic Kafka
- [ ] **M4** Notifiche: servizio WebFlux e stream SSE
- [ ] **M5** Applicazione Angular
- [ ] **M6** Qualità e rilascio v1.0

## Autore

**Limber Mendoza**, sviluppatore Full Stack a Salerno.
[LinkedIn](https://www.linkedin.com/in/limber-mendoza-tolentino-852771142/) · [mlimber64@gmail.com](mailto:mlimber64@gmail.com)
