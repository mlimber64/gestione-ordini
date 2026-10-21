import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService, decodeUser } from './auth.service';
import { fakeJwt } from './testing';

describe('decodeUser', () => {
  it("legge utente e ruoli dal token", () => {
    expect(decodeUser(fakeJwt({ sub: 'mario', roles: ['OPERATOR'] }))).toEqual({ username: 'mario', roles: ['OPERATOR'] });
  });

  it('restituisce null per token assenti o malformati', () => {
    expect(decodeUser(null)).toBeNull();
    expect(decodeUser('non-un-token')).toBeNull();
  });
});

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const pair = (roles: string[]) => ({
    accessToken: fakeJwt({ sub: 'anna', roles }),
    refreshToken: 'refresh-1',
    tokenType: 'Bearer',
    expiresIn: 900,
  });

  it('dopo il login espone utente e ruoli e salva solo il refresh token nella sessione', () => {
    auth.login('anna', 'password').subscribe();
    const request = http.expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({ username: 'anna', password: 'password' });
    request.flush(pair(['ADMIN']));

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.user()?.username).toBe('anna');
    expect(auth.isAdmin()).toBe(true);
    expect(auth.canWrite()).toBe(true);
    expect(sessionStorage.getItem('gestione-ordini.refresh')).toBe('refresh-1');
    expect(sessionStorage.length).toBe(1);
  });

  it('un utente di sola lettura non può modificare', () => {
    auth.login('v', 'p').subscribe();
    http.expectOne('/api/v1/auth/login').flush(pair(['VIEWER']));

    expect(auth.canWrite()).toBe(false);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.hasRole('VIEWER')).toBe(true);
  });

  it('più refresh simultanei fanno una sola chiamata', () => {
    sessionStorage.setItem('gestione-ordini.refresh', 'refresh-0');
    const results: string[] = [];
    auth.refresh().subscribe((token) => results.push(token));
    auth.refresh().subscribe((token) => results.push(token));

    http.expectOne('/api/v1/auth/refresh').flush(pair(['OPERATOR']));

    expect(results).toHaveLength(2);
    expect(results[0]).toBe(results[1]);
  });

  it('se il refresh fallisce la sessione si chiude', () => {
    sessionStorage.setItem('gestione-ordini.refresh', 'scaduto');
    auth.restore().subscribe((restored) => expect(restored).toBe(false));
    http.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem('gestione-ordini.refresh')).toBeNull();
  });

  it('senza refresh token salvato non prova nemmeno a ripristinare', () => {
    auth.restore().subscribe((restored) => expect(restored).toBe(false));
    http.expectNone('/api/v1/auth/refresh');
  });

  it('il logout cancella token e sessione', () => {
    auth.login('anna', 'p').subscribe();
    http.expectOne('/api/v1/auth/login').flush(pair(['ADMIN']));

    auth.logout(false);

    expect(auth.accessToken()).toBeNull();
    expect(sessionStorage.getItem('gestione-ordini.refresh')).toBeNull();
  });
});
