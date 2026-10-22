import { credentials, baseUrl, connectUrl } from './tests/support/api';

const TIMEOUT_MS = 5 * 60_000;

async function waitUntil(description: string, check: () => Promise<string | null>): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let lastProblem = 'nessuna risposta';
  while (Date.now() < deadline) {
    try {
      const problem = await check();
      if (problem === null) return;
      lastProblem = problem;
    } catch (error) {
      lastProblem = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`${description} non è pronto dopo 5 minuti (${lastProblem})`);
}

/**
 * Aspetta che lo stack risponda: dopo `compose up` i servizi Spring impiegano qualche decina di secondi.
 * Se si prova la modalità CDC (E2E_CONNECT_URL) aspetta anche che il connettore Debezium sia in esecuzione, così
 * le prime notifiche non dipendono dai tempi di avvio di Kafka Connect.
 */
export default async function globalSetup(): Promise<void> {
  await waitUntil(`Lo stack su ${baseUrl}`, async () => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    return response.ok ? null : `login -> ${response.status}`;
  });

  if (connectUrl) {
    await waitUntil(`Il connettore Debezium su ${connectUrl}`, async () => {
      const response = await fetch(`${connectUrl}/connectors/outbox/status`);
      if (!response.ok) return `stato -> ${response.status}`;
      const status = (await response.json()) as { connector: { state: string }; tasks: { state: string }[] };
      const running = status.connector.state === 'RUNNING' && status.tasks.length > 0 && status.tasks.every((t) => t.state === 'RUNNING');
      return running ? null : `connettore ${status.connector.state}, task ${status.tasks.map((t) => t.state).join(',')}`;
    });
  }
}
