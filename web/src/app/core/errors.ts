import { HttpErrorResponse } from '@angular/common/http';

/** Estrae un messaggio leggibile da una risposta di errore (RFC 9457, `application/problem+json`). */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Server non raggiungibile. Controlla la connessione e riprova.';
    const problem = error.error as { detail?: string; errors?: Record<string, string> } | null;
    if (problem?.errors) {
      const fields = Object.entries(problem.errors).map(([field, message]) => `${field}: ${message}`);
      if (fields.length) return fields.join(' · ');
    }
    if (problem?.detail) return problem.detail;
    if (error.status === 403) return 'Non hai i permessi per questa operazione.';
    if (error.status === 404) return 'Elemento non trovato.';
  }
  return 'Si è verificato un errore imprevisto.';
}
