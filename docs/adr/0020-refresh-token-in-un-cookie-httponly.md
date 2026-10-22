# ADR 0020: Token di refresh in un cookie HttpOnly

- Stato: accettata (sostituisce la parte sulla sessione dell'ADR 0013)
- Data: 2026-10-22

## Contesto

Il frontend teneva il token di refresh in `sessionStorage` (ADR 0013). Un token lì è leggibile da qualsiasi script che giri nella pagina: se un attacco XSS riuscisse a eseguire codice, potrebbe copiarlo e usarlo per ottenere accessi nuovi per sette giorni, anche da un altro computer. Il token di accesso, in memoria e valido 15 minuti, espone molto meno.

## Decisione

**Il token di refresh viaggia solo in un cookie `HttpOnly`.** Il server lo imposta al login e lo rinnova a ogni refresh; il browser lo rimanda da solo alle chiamate a `/api/v1/auth`. Il codice JavaScript non lo vede mai, nemmeno il nostro: non compare nel corpo delle risposte né in nessuno spazio di memorizzazione del browser.

| Attributo | Perché |
|---|---|
| `HttpOnly` | Nessuno script può leggerlo: è il punto della modifica |
| `SameSite=Strict` | Il browser non lo manda nelle richieste che partono da altri siti: protegge refresh e logout da richieste falsificate (CSRF) senza token aggiuntivi |
| `Path=/api/v1/auth` | Non viaggia con le altre chiamate: solo dove serve |
| `Secure` quando la richiesta è in HTTPS | Nessuna copia in chiaro. Lo schema arriva da nginx con `X-Forwarded-Proto` e dal `forward-headers-strategy` di Spring |
| Nessuna scadenza (cookie «di sessione») | Si perde alla chiusura del browser, come prima con la chiusura della scheda. Il token resta valido al massimo sette giorni per il server |

**Cosa cambia nell'API.** `POST /login` e `POST /refresh` restituiscono nel corpo solo il token di accesso. `POST /refresh` non vuole più il token nel corpo: lo legge dal cookie e non accetta altro. Se il cookie manca o non vale risponde `401` e lo toglie. `POST /logout` (nuovo) elimina il cookie. Il token di accesso resta nell'intestazione `Authorization` e non cambia.

**Cosa cambia nel frontend.** `AuthService` non usa più `sessionStorage`. Al caricamento chiama `refresh` e, se il cookie c'è, ripristina la sessione: la pagina non può sapere se c'è (è `HttpOnly`), quindi prova e basta. Un visitatore senza sessione vede un `401` in più nella rete, normale con questo schema.

## Conseguenze

- **Un XSS non può più rubare il token di refresh.** Può ancora agire come l'utente mentre la pagina è aperta (chiamare le API con il token di accesso in memoria): la CSP e l'assenza di HTML non fidato restano le difese principali.
- **Le schede condividono la sessione.** Prima ogni scheda chiedeva il suo login; ora basta uno e le altre restano dentro, come ci si aspetta da un sito. Il logout in una scheda lascia le altre con il token di accesso fino alla scadenza (15 minuti), perché il token non si può revocare.
- **Il token resta non revocabile** (ADR 0009). Il logout toglie il cookie ma non invalida un token già copiato; per questo contano la durata breve dell'accesso e la protezione del cookie.
- **Richiede un solo origin per le chiamate di autenticazione.** Con `SameSite=Strict` il frontend e `/api` devono stare nello stesso sito, come già fanno con nginx e con il proxy di sviluppo di Angular.
- **Con un identity provider esterno** il rifiuto del refresh e la revoca li gestirebbe il provider; la stessa forma (cookie `HttpOnly` impostato dal server) vale anche allora.
