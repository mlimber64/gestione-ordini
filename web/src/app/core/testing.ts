/** Crea un JWT senza firma valida: l'interfaccia ne legge solo il contenuto, quindi nei test basta questo. */
export function fakeJwt(claims: Record<string, unknown>): string {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256' })}.${encode(claims)}.firma`;
}