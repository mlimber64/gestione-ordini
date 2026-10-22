// Carica dati di esempio tramite l'API, così l'applicazione si prova subito con qualcosa da vedere.
// Uso (Node 18 o successivo):  node deploy/seed.mjs [URL] [utente] [password]
// Predefiniti: http://localhost:8080, admin, admin-demo-1234 (stack Docker; in sviluppo locale usare http://localhost:8081 e admin-dev-1234).
// Si può rilanciare: se il catalogo di esempio esiste già, non fa nulla.

const [base = 'http://localhost:8080', username = 'admin', password = 'admin-demo-1234'] = process.argv.slice(2);

async function call(path, method = 'GET', body, token) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${data?.detail ?? text}`);
  return data;
}

/** Partita IVA valida: 10 cifre a scelta più la cifra di controllo (stesso algoritmo del server). */
function vatNumber(seed) {
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

const { accessToken: token } = await call('/api/v1/auth/login', 'POST', { username, password });
const api = (path, method, body) => call(path, method, body, token);

const existing = await api('/api/v1/products?q=CAN-001');
if (existing.totalElements > 0) {
  console.log('Dati di esempio già presenti: niente da fare.');
  process.exit(0);
}

console.log('Categorie e prodotti…');
const category = async (name, parentId = null) => (await api('/api/v1/categories', 'POST', { name, parentId })).id;
const cancelleria = await category('Cancelleria');
const carta = await category('Carta e quaderni', cancelleria);
const informatica = await category('Informatica');
const arredo = await category('Arredo ufficio');

const catalog = [
  ['CAN-001', 'Penna a sfera blu (conf. 50)', carta, 12.9, 22, 120, 30],
  ['CAN-002', 'Quaderno A4 a quadretti', carta, 2.4, 22, 300, 80],
  ['CAN-003', 'Risma carta A4 80 g (500 fogli)', carta, 5.8, 22, 200, 60],
  ['CAN-004', 'Evidenziatori assortiti (conf. 6)', cancelleria, 6.5, 22, 90, 25],
  ['INF-001', 'Mouse ottico USB', informatica, 9.9, 22, 60, 15],
  ['INF-002', 'Tastiera italiana', informatica, 24.5, 22, 40, 10],
  ['INF-003', 'Monitor 24" Full HD', informatica, 139, 22, 18, 5],
  ['INF-004', 'Cavo HDMI 2 m', informatica, 7.2, 22, 70, 20],
  ['ARR-001', 'Sedia ergonomica da ufficio', arredo, 189, 22, 12, 4],
  ['ARR-002', 'Lampada da scrivania LED', arredo, 29.9, 22, 25, 8],
  ['ARR-003', 'Scrivania 140 x 70 cm', arredo, 215, 22, 6, 2],
  ['LIB-001', 'Manuale di contabilità', carta, 34, 4, 15, 5],
].map(([sku, name, categoryId, unitPrice, vatRate, stock, reorderLevel]) => ({ sku, name, categoryId, unitPrice, vatRate, stock, reorderLevel }));

const products = {};
for (const item of catalog) {
  const { stock, reorderLevel, ...input } = item;
  const created = await api('/api/v1/products', 'POST', { ...input, description: null });
  await api(`/api/v1/inventory/${created.id}/receipts`, 'POST', { quantity: stock, note: 'Carico iniziale' });
  await api(`/api/v1/inventory/${created.id}/reorder-level`, 'PATCH', { reorderLevel });
  products[item.sku] = created;
}

console.log('Clienti…');
const customerData = [
  ['Rossi Forniture Srl', 'ordini@rossiforniture.example', 'Via Roma 24', 'Salerno', 'SA', '84121'],
  ['Studio Bianchi & Associati', 'segreteria@studiobianchi.example', 'Corso Vittorio Emanuele 112', 'Napoli', 'NA', '80121'],
  ['Ferrara Costruzioni Spa', 'acquisti@ferraracostruzioni.example', 'Via dei Mercanti 12', 'Salerno', 'SA', '84122'],
  ['Cartoleria Il Pennino', 'info@ilpennino.example', 'Via Mazzini 7', 'Avellino', 'AV', '83100'],
  ['Esposito Impianti Snc', 'amministrazione@espositoimpianti.example', 'Via Toledo 210', 'Napoli', 'NA', '80134'],
  ['Studio Dentistico Greco', 'studio@dentistagreco.example', 'Via Nazionale 45', 'Battipaglia', 'SA', '84091'],
];
const customers = [];
for (const [index, [name, email, street, city, province, postalCode]] of customerData.entries()) {
  const customer = await api('/api/v1/customers', 'POST', {
    name, email, phone: null, vatNumber: vatNumber(1234500 + index * 37), taxCode: null,
  });
  await api(`/api/v1/customers/${customer.id}/addresses`, 'POST', {
    type: 'SHIPPING', street, city, province, postalCode, country: 'IT', defaultAddress: true,
  });
  customers.push(customer);
}

console.log('Ordini…');
const order = (customer, ...lines) =>
  api('/api/v1/orders', 'POST', {
    customerId: customer.id,
    shippingAddressId: null,
    notes: null,
    items: lines.map(([sku, quantity]) => ({ productId: products[sku].id, quantity })),
  });

const delivered = await order(customers[0], ['CAN-003', 20], ['CAN-001', 4]);
await api(`/api/v1/orders/${delivered.id}/confirm`, 'POST');
await api(`/api/v1/orders/${delivered.id}/ship`, 'POST');
await api(`/api/v1/orders/${delivered.id}/deliver`, 'POST');

const shipped = await order(customers[1], ['INF-002', 6], ['INF-001', 6]);
await api(`/api/v1/orders/${shipped.id}/confirm`, 'POST');
await api(`/api/v1/orders/${shipped.id}/ship`, 'POST');

const confirmed = await order(customers[2], ['ARR-001', 8], ['ARR-003', 4]);
await api(`/api/v1/orders/${confirmed.id}/confirm`, 'POST');

await order(customers[3], ['CAN-002', 60], ['CAN-004', 12]);
await order(customers[4], ['INF-003', 14], ['INF-004', 20]);

const cancelled = await order(customers[5], ['ARR-002', 5]);
await api(`/api/v1/orders/${cancelled.id}/cancel`, 'POST', { reason: 'Il cliente ha cambiato idea' });

console.log('Pagamenti…');
const payment = (target, method, amount, reference) =>
  api(`/api/v1/orders/${target.id}/payments`, 'POST', { method, amount, reference });
const collect = (created) => api(`/api/v1/payments/${created.id}/pay`, 'POST');
// Consegnato e saldato con un bonifico
await collect(await payment(delivered, 'BANK_TRANSFER', delivered.totalGross, 'CRO 0123456789'));
// Spedito con un acconto con carta: resta da incassare la metà
const deposit = Math.round(shipped.totalGross * 50) / 100;
await collect(await payment(shipped, 'CARD', deposit, 'Acconto 50%'));
// Confermato, da pagare al ritiro: il contrassegno resta in attesa
await payment(confirmed, 'CASH_ON_DELIVERY', confirmed.totalGross, null);

console.log(`Fatto: ${catalog.length} prodotti, ${customers.length} clienti e 6 ordini in stati diversi, tre con pagamenti.`);
console.log('Gli ordini per INF-003 e ARR-001 portano alcuni prodotti sotto la soglia: compaiono tra le scorte basse.');
