/** Accesso diretto all'API per preparare i dati: i test provano l'interfaccia, non la costruzione delle fixture. */

export const baseUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

/** API REST di Kafka Connect; si imposta solo provando la modalità CDC (Debezium), altrimenti è vuota. */
export const connectUrl = process.env.E2E_CONNECT_URL ?? '';

/** Indirizzo HTTPS (con HTTP/2) dello stesso stack; il certificato è autofirmato. */
export const tlsUrl = process.env.E2E_TLS_URL ?? 'https://localhost:8443';

/**
 * Come si autentica l'applicazione sotto prova: `local` (login interno, di base) oppure `oidc` (Keycloak, ADR 0021).
 * In modalità oidc l'interfaccia passa dalla pagina di accesso di Keycloak; per preparare i dati via API si usa il
 * client di test `gestione-ordini-e2e` del realm, che ammette il login con password.
 */
export const authMode: 'local' | 'oidc' = process.env.E2E_AUTH === 'oidc' ? 'oidc' : 'local';

export const credentials = {
  username: process.env.E2E_USER ?? 'admin',
  password: process.env.E2E_PASSWORD ?? 'admin-demo-1234',
};

export interface Fixture {
  customerId: string;
  customerName: string;
  productId: string;
  productSku: string;
  productName: string;
}

/** Token di accesso di un utente, ottenuto direttamente dall'API (non dall'interfaccia). */
export async function accessTokenFor({ username, password } = credentials): Promise<string> {
  if (authMode === 'local') {
    const { accessToken } = await call<{ accessToken: string }>('/api/v1/auth/login', 'POST', { username, password });
    return accessToken;
  }
  const response = await fetch(`${baseUrl}/auth/realms/gestione-ordini/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'password', client_id: 'gestione-ordini-e2e', username, password }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`token Keycloak -> ${response.status}: ${text}`);
  return (JSON.parse(text) as { access_token: string }).access_token;
}

async function call<T>(path: string, method: string, body?: unknown, token?: string): Promise<T> {
  const response = await fetch(baseUrl + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  return (text ? JSON.parse(text) : null) as T;
}

/** Partita IVA valida (stessa cifra di controllo del server) partendo da un seme numerico. */
function vatNumber(seed: number): string {
  const digits = String(seed).padStart(10, '0').slice(0, 10).split('').map(Number);
  const sum = digits.reduce((total, digit, index) => {
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    return total + digit;
  }, 0);
  return digits.join('') + ((10 - (sum % 10)) % 10);
}

/**
 * Crea un cliente con indirizzo di spedizione e un prodotto con giacenza, con nomi unici per ogni esecuzione
 * così il test si può ripetere sullo stesso database senza dipendere da dati precedenti.
 */
export async function createFixture(): Promise<Fixture> {
  const accessToken = await accessTokenFor();
  const api = <T>(path: string, method = 'GET', body?: unknown) => call<T>(path, method, body, accessToken);

  const suffix = Date.now().toString(36).toUpperCase();
  const customerName = `E2E Cliente ${suffix}`;
  const productSku = `E2E-${suffix}`;
  const productName = `E2E Prodotto ${suffix}`;

  const category = await api<{ id: string }>('/api/v1/categories', 'POST', { name: `E2E ${suffix}`, parentId: null });
  const product = await api<{ id: string }>('/api/v1/products', 'POST', {
    sku: productSku,
    name: productName,
    description: null,
    categoryId: category.id,
    unitPrice: 10,
    vatRate: 22,
  });
  await api(`/api/v1/inventory/${product.id}/receipts`, 'POST', { quantity: 50, note: 'Carico E2E' });

  const customer = await api<{ id: string }>('/api/v1/customers', 'POST', {
    name: customerName,
    email: `e2e-${suffix.toLowerCase()}@example.test`,
    phone: null,
    vatNumber: vatNumber(Date.now() % 10_000_000_000),
    taxCode: null,
  });
  await api(`/api/v1/customers/${customer.id}/addresses`, 'POST', {
    type: 'SHIPPING',
    street: 'Via del Test 1',
    city: 'Salerno',
    province: 'SA',
    postalCode: '84121',
    country: 'IT',
    defaultAddress: true,
  });

  return { customerId: customer.id, customerName, productId: product.id, productSku, productName };
}

/** Crea direttamente un ordine del cliente per `quantity` pezzi del prodotto (10 € + IVA 22% l'uno). */
export async function createOrder(fixture: Fixture, quantity = 3): Promise<{ id: string; number: string }> {
  const accessToken = await accessTokenFor();
  return call<{ id: string; number: string }>(
    '/api/v1/orders',
    'POST',
    {
      customerId: fixture.customerId,
      shippingAddressId: null,
      notes: null,
      items: [{ productId: fixture.productId, quantity }],
    },
    accessToken,
  );
}
