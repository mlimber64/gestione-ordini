# ADR 0023: Le azioni che modificano dati passano da finestre modali

- Stato: accettata (integra l'ADR 0022)
- Data: 2026-10-22

## Contesto

Alcune azioni usavano il `confirm()` del browser (blocco di un cliente, eliminazione di un indirizzo), altre partivano con un solo clic (conferma, spedizione e consegna di un ordine, incasso e rimborso di un pagamento, disattivazione di un prodotto) e il nuovo cliente era una pagina intera. Il comportamento era disomogeneo e il `confirm()` non si può curare nell'aspetto né provare in modo affidabile.

## Decisione

**Una finestra di conferma riutilizzabile** (`ConfirmService.ask`): titolo che dice che cosa si sta per fare, messaggio con l'effetto (merce scaricata, importo che torna da incassare…), pulsante con il verbo dell'azione («Spedisci», «Blocca cliente») invece di un generico «Sì», e un tono — neutro, di attenzione o di pericolo — che si vede nel colore dell'icona e del pulsante. Chiudere la finestra, premere Esc o scegliere «Indietro» è sempre un no.

**Si chiede conferma dove l'azione ha conseguenze**, non ovunque: confermare, spedire e consegnare un ordine; incassare, segnare come non riuscito e rimborsare un pagamento; disattivare un prodotto (attivarlo no); bloccare un cliente; eliminare un indirizzo. Annullare un ordine aveva già la sua finestra con il motivo. Salvare un modulo non chiede conferma: c'è già il pulsante.

**Le registrazioni si fanno in una finestra**: il nuovo cliente, con l'indirizzo di spedizione facoltativo nello stesso passaggio (così può già ricevere ordini). La scheda del cliente resta una pagina, perché contiene anche gli indirizzi. Il nuovo ordine resta una pagina: ha troppe parti (cliente, righe, note) per una finestra.

**Intestazione comune** (`DialogHeader`): icona, titolo, sottotitolo facoltativo e pulsante per chiudere in tutte le finestre.

## Conseguenze

- Un clic in più per le azioni con conseguenze: è voluto. Le finestre sono provate dai test unitari (sì, no e Esc per ogni azione) e di punta a punta (Playwright).
- Lo stato dei dati non cambia se si rinuncia: per l'interruttore dei prodotti, che si sposta prima della domanda, la rinuncia lo riporta com'era.
- La pagina `/clienti/nuovo` non esiste più.
