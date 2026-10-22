# ADR 0022: Sistema di design dell'interfaccia

- Stato: accettata (integra l'ADR 0013)
- Data: 2026-10-22

## Contesto

L'interfaccia del v1.0 usava Angular Material quasi con i valori predefiniti: azzurro generico, schede tutte uguali, colori degli stati scritti a mano nei componenti e solo tema chiaro. Funzionava, ma senza gerarchia visiva e senza un posto unico dove cambiare l'aspetto.

## Decisione

**Si resta su Angular Material 3 e si costruisce un sistema sopra.** Cambiare libreria costerebbe molto e non darebbe nulla che i token non diano. Tre livelli:

1. **Tema Material.** La palette (petrolio, con secondario e terziario derivati) si genera da pochi colori con lo schematic ufficiale (`ng generate @angular/material:m3-theme`) e sta in `src/theme/_theme-colors.scss`. Chiaro e scuro si ottengono dallo stesso tema con `light-dark()`: di base segue il sistema (`color-scheme: light dark`) e `data-theme` sull'elemento radice forza una scelta.
2. **Token dell'applicazione** (`--app-*`, in `src/styles.scss`): stati (`ok`, `warn`, `bad`, `info`, ciascuno con sfondo, testo e tinta piena per i grafici), raggi, ombre, superfici e menu laterale. Le schermate usano i token, mai un colore scritto a mano.
3. **Classi condivise**: `.page`, `.page-header`, `.card`, `.table-card`, `.chip`, `.empty`, `.skeleton`. Una schermata nuova nasce già coerente.

**Menu laterale scuro in entrambi i temi.** È il solo elemento forte dell'interfaccia e dà identità; il resto resta sobrio. Si può comprimere a sole icone (ogni voce mantiene il suo nome accessibile e un suggerimento) e su schermi stretti diventa un cassetto. La scelta si ricorda nel browser.

**Lo stato non dipende solo dal colore.** Ogni chip ha un pallino e un'etichetta; le fasce di attenzione hanno icona e testo.

**Grafici senza librerie.** L'anello degli ordini per stato è SVG puro (circonferenza 100, quindi le lunghezze sono percentuali) e le barre sono CSS: pochi byte e niente da aggiornare. Una libreria di grafici avrebbe senso solo con serie temporali.

**Tema e preferenze nel browser.** `ThemeService` e il menu compresso usano `localStorage` dentro un `try/catch`: se non è disponibile l'applicazione funziona lo stesso e la scelta vale solo per la visita.

## Conseguenze

- Cambiare l'identità visiva vuol dire rigenerare la palette e ritoccare pochi token.
- I test di punta a punta verificano tema (anche il colore reale dello sfondo), menu compresso e cassetto sui telefoni.
- Il lavoro continua per aree (elenchi, dettaglio ordine, moduli) con gli stessi token: l'incidenza #39 le elenca.
- Il tema scuro raddoppia i casi da guardare: ogni componente nuovo va provato in entrambi.
