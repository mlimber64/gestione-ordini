# ADR 0012: Notifiche in tempo reale con SSE e consumer idempotente

- Stato: accettata
- Data: 2026-10-21

## Contesto

L'interfaccia deve mostrare gli ordini e gli avvisi di scorta bassa appena accadono, senza ricaricare la pagina. Kafka consegna ogni messaggio "almeno una volta" (ADR 0011): lo stesso evento può arrivare due volte. Un messaggio malformato non deve bloccare tutti quelli che lo seguono.

## Decisione

**Servizio separato e reattivo.** `notification-service` usa WebFlux e R2DBC. Qui il reattivo ha senso: molte connessioni SSE aperte a lungo, quasi tutte inattive, servite da pochi thread. Non conosce le regole di business, solo gli eventi.

**SSE invece di WebSocket.** Il flusso è solo dal server al client, e SSE si appoggia a HTTP normale: nessun protocollo in più, ricollegamento automatico del browser, funziona con proxy e CORS standard. L'autenticazione resta l'intestazione `Authorization: Bearer`; il token **non** viaggia nell'URL, quindi il client Angular userà `fetch` in streaming e non `EventSource`.

**Riprendere senza buchi.** Ogni notifica ha un `id` crescente, usato come identificativo SSE. Un client che si ricollega con `Last-Event-ID` riceve prima quanto ha perso (fino a 500 notifiche, dal database) e poi continua in diretta, senza buchi né doppioni. Un `ping` ogni 25 secondi tiene viva la connessione.

**Consumer idempotente.** `notification_event.event_id` è `UNIQUE` e l'inserimento usa `ON CONFLICT DO NOTHING`: se l'evento è un duplicato non viene salvato né inoltrato ai client. L'idempotenza è nel database, non in una cache in memoria, quindi regge ai riavvii e a più istanze.

**Messaggi che non si riescono a elaborare.** Un errore transitorio si ritenta tre volte a intervalli di un secondo. Un messaggio illeggibile (JSON non valido, campi mancanti) non si ritenta: va subito nel topic `<topic>.DLT` e il consumo prosegue. Un tipo di evento sconosciuto si ignora, così un order-service più nuovo non rompe uno più vecchio.

**Thread del listener bloccato di proposito.** Il listener Kafka attende la fine della pipeline reattiva (`block`). Kafka registra l'offset solo dopo il salvataggio e, se il database rallenta, il consumo rallenta invece di accumulare messaggi in memoria.

**Sicurezza.** Il servizio verifica i JWT di order-service (stesso segreto HS256 e stesso emittente), accetta solo token di accesso e non ne emette. Ogni utente autenticato può leggere. Le metriche richiedono il ruolo ADMIN.

## Conseguenze

- Un client lento perde le notifiche più vecchie del suo buffer (1000) invece di bloccare gli altri; al ricollegamento le recupera con `Last-Event-ID`.
- L'ordine di arrivo vale per topic: eventi di topic diversi (per esempio scorta bassa e cambio di stato) possono arrivare in ordine diverso da quello in cui sono accaduti. `occurredAt` conserva l'ora reale.
- Il segreto JWT è condiviso tra i due servizi. Con un identity provider esterno (ADR 0009) si passerebbe a chiavi pubbliche.
- Il browser non può usare `EventSource` nativo; in sviluppo il frontend passa da un proxy per evitare problemi di CORS.
