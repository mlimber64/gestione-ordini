import { credentials, baseUrl } from './tests/support/api';

/** Aspetta che lo stack risponda: dopo `compose up` i servizi Spring impiegano qualche decina di secondi. */
export default async function globalSetup(): Promise<void> {
  const deadline = Date.now() + 5 * 60_000;
  let lastError = 'nessuna risposta';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      if (response.ok) return;
      lastError = `login -> ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Lo stack su ${baseUrl} non è pronto dopo 5 minuti (${lastError})`);
}
