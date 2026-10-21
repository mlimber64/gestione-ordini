# ADR 0010: Riserva atomica delle giacenze e macchina a stati dell'ordine

- Stato: accettata
- Data: 2026-10-21

## Contesto

Due ordini simultanei per l'ultimo pezzo in magazzino non devono riuscire entrambi. Il classico schema "leggo la giacenza, controllo, riscrivo" lo permette: tra la lettura e la scrittura l'altra richiesta ha già venduto lo stesso pezzo. Lo stesso rischio c'è quando un ordine viene annullato due volte (doppio clic): la merce non deve essere liberata due volte.

## Decisione

**Riserva atomica.** Ogni variazione di giacenza è un unico `UPDATE` condizionale, per esempio:

```sql
UPDATE inventory SET reserved = reserved + :q
WHERE product_id = :p AND on_hand - reserved >= :q
```

Se l'aggiornamento tocca zero righe, la giacenza non basta e l'API risponde `409`. Verifica e modifica avvengono insieme, protette dal lock di riga di PostgreSQL. In più, un vincolo `CHECK (reserved <= on_hand)` impedisce al database di arrivare a uno stato impossibile anche in caso di bug.

**Una transazione per operazione.** Creare un ordine salva la testata, le righe e riserva la merce di tutte le righe nella stessa transazione: se una riga fallisce, si annulla anche la riserva delle altre.

**Niente deadlock.** Le righe si toccano sempre in ordine di identificativo del prodotto. Due ordini con gli stessi prodotti in ordine diverso non si attendono a vicenda.

**Macchina a stati nel dominio.** Le transizioni (`PENDING → CONFIRMED → SHIPPED → DELIVERED`, annullamento da `PENDING` o `CONFIRMED`) sono definite solo in `OrderStatus`. Il dominio non conosce JPA né JDBC; ArchUnit lo verifica.

**Concorrenza ottimistica sugli ordini.** L'ordine ha una `@Version` e viene scritto subito (`flush`) prima di toccare il magazzino: se due richieste modificano lo stesso ordine, la seconda fallisce con `409` e la sua transazione, magazzino compreso, si annulla. Così un doppio annullamento libera la merce una volta sola.

**Copia dei dati.** L'ordine conserva una copia del cliente, dell'indirizzo, del codice, del nome e del prezzo dei prodotti: lo storico non cambia se poi cambiano anagrafica o listino.

## Conseguenze

- Le giacenze si leggono con SQL esplicito (`JdbcClient`), non con JPA: è la scelta giusta per aggiornamenti condizionali, ma lo schema va tenuto allineato a mano.
- I test di concorrenza usano dati realmente confermati nel database (senza transazione di test) e li ripuliscono alla fine.
- Il pagamento resta fuori dalla versione 1.0; l'ordine confermato presuppone un pagamento fuori dal sistema.
