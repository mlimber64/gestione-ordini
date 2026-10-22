# ADR 0018: Pagamenti registrati a mano

- Stato: accettata
- Data: 2026-10-22

## Contesto

Il progetto iniziale prevedeva una tabella `payment` che nella versione 1.0 è stata rimandata. Un ordine aveva un totale ma nessun modo di dire quanto fosse stato incassato. Le scelte da fare erano due: come entra il denaro nel sistema (a mano o tramite un fornitore di pagamenti) e se il pagamento deve comandare lo stato dell'ordine.

## Decisione

**Registrazione manuale.** Un operatore registra un pagamento di un ordine indicando metodo (bonifico, carta, contrassegno), importo e un riferimento facoltativo (il CRO del bonifico, il codice della transazione). Nessun fornitore esterno: il sistema è un gestionale interno e un'integrazione vera richiederebbe account, chiavi e webhook che qui non si possono provare da cima a fondo. Il modello non lo impedisce: un domani un fornitore potrebbe registrare e incassare gli stessi pagamenti.

**Stati di un pagamento.** Nasce `PENDING` (in attesa); da lì passa a `PAID` (incassato) o `FAILED` (non riuscito). Solo un pagamento incassato si può rimborsare (`REFUNDED`). `FAILED` e `REFUNDED` sono finali. Il contrassegno resta in attesa finché non si incassa alla consegna. Le regole stanno in un dominio puro, come per gli ordini (ArchUnit lo verifica).

**Più pagamenti per ordine.** Servono acconti e saldi. Il riepilogo dice quanto è stato incassato, quanto è in attesa e quanto si può ancora registrare, e ne ricava un semplice stato: `UNPAID`, `PARTIAL` o `PAID`.

**Il pagamento non comanda l'ordine.** Lo stato dell'ordine segue la sua macchina a stati (ADR 0010) e non cambia se arriva un pagamento: in un gestionale si spedisce spesso con acconto, a credito o in contrassegno. Il pagamento è un dato a parte, collegato all'ordine. Il modulo `payment` usa l'ordine, ma l'ordine non conosce i pagamenti: nessuna dipendenza circolare e nessun rischio per ciò che c'era già.

**Mai oltre il totale, anche con richieste simultanee.** La somma dei pagamenti in attesa e incassati non può superare il totale dell'ordine, e il vincolo si controlla nell'applicazione. Due richieste simultanee leggerebbero però lo stesso residuo e passerebbero entrambe. Per questo la registrazione prende un lock consultivo di PostgreSQL legato alla transazione e relativo a quell'ordine: le registrazioni dello stesso ordine si mettono in fila, quelle di ordini diversi no. Il test lo prova: dieci pagamenti simultanei da 10 € su un ordine da 61 € ne accettano esattamente sei. Senza il lock ne passavano nove (provato togliendolo).

**Modifiche concorrenti dello stesso pagamento.** Ogni pagamento ha una versione e l'aggiornamento è condizionato a quella letta: un doppio clic su «Incassa» produce un solo incasso e un errore di conflitto per gli altri.

**Permessi.** Tutti gli utenti autenticati leggono; registrare, incassare, segnare come non riuscito e rimborsare richiede ADMIN o OPERATOR.

## Conseguenze

- Un ordine annullato non accetta nuovi pagamenti, ma quelli già registrati restano visibili e non si toccano da soli: se era stato incassato qualcosa, va rimborsato a mano.
- Non c'è ancora un evento per i pagamenti, quindi le notifiche in diretta non li annunciano. Aggiungerlo seguirebbe il contratto degli eventi (ADR 0011).
- Gli importi hanno al massimo due decimali e si confrontano come `BigDecimal`, mai come numeri in virgola mobile.
- Il rimborso è solo un cambio di stato: non genera un movimento di denaro verso il cliente né un pagamento negativo.
