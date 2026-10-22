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
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const token = (roles: string[]) => ({
    accessToken: fakeJwt({ sub: 'anna', roles }),
    tokenType: 'Bearer',
    expiresIn: 900,
  });

  it('dopo il login espone utente e ruoli e non salva nulla nel browser', () => {
    auth.login('anna', 'password').subscribe();
    const request = http.expectOne('/api/v1/auth/login');
    expect(request.request.body).toEqual({ username: 'anna', password: 'password' });
    request.flush(token(['ADMIN']));

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.user()?.username).toBe('anna');
    expect(auth.isAdmin()).toBe(true);
    expect(auth.canWrite()).toBe(true);
    // Il token di refresh è in un cookie HttpOnly: la pagina non ne conserva nessuna copia
    expect(sessionStorage.length).toBe(0);
    expect(localStorage.length).toBe(0);
  });

  it('un utente di sola lettura non può modificare', () => {
    auth.login('v', 'p').subscribe();
    http.expectOne('/api/v1/auth/login').flush(token(['VIEWER']));

    expect(auth.canWrite()).toBe(false);
    expect(auth.isAdmin()).toBe(false);
    expect(auth.hasRole('VIEWER')).toBe(true);
  });

  it('il refresh non manda nessun token: ci pensa il cookie', () => {
    auth.refresh().subscribe();

    const request = http.expectOne('/api/v1/auth/refresh');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBeNull();
    request.flush(token(['OPERATOR']));
  });

  it('più refresh simultanei fanno una sola chiamata', () => {
    const results: string[] = [];
    auth.refresh().subscribe((value) => results.push(value));
    auth.refresh().subscribe((value) => results.push(value));

    http.expectOne('/api/v1/auth/refresh').flush(token(['OPERATOR']));

    expect(results).toHaveLength(2);
    expect(results[0]).toBe(results[1]);
  });

  it('all\'avvio prova a ripristinare la sessione dal cookie, anche se la pagina non può vederlo', () => {
    let restored: boolean | undefined;
    auth.restore().subscribe((value) => (restored = value));

    http.expectOne('/api/v1/auth/refresh').flush(token(['ADMIN']));

    expect(restored).toBe(true);
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('se il refresh fallisce (cookie assente o scaduto) resta senza accesso', () => {
    let restored: boolean | undefined;
    auth.restore().subscribe((value) => (restored = value));
    http.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(restored).toBe(false);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('se il refresh fallisce durante la sessione toglie il token di accesso', () => {
    auth.login('anna', 'p').subscribe();
    http.expectOne('/api/v1/auth/login').flush(token(['ADMIN']));

    auth.refresh().subscribe({ error: () => undefined });
    http.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(auth.accessToken()).toBeNull();
  });

  it('il logout toglie il token dalla memoria e chiede al server di eliminare il cookie', () => {
    auth.login('anna', 'p').subscribe();
    http.expectOne('/api/v1/auth/login').flush(token(['ADMIN']));

    auth.logout(false);

    expect(auth.accessToken()).toBeNull();
    const request = http.expectOne('/api/v1/auth/logout');
    expect(request.request.method).toBe('POST');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('il logout chiude la sessione anche se il server non risponde', () => {
    auth.login('anna', 'p').subscribe();
    http.expectOne('/api/v1/auth/login').flush(token(['ADMIN']));

    auth.logout(false);
    http.expectOne('/api/v1/auth/logout').error(new ProgressEvent('error'));

    expect(auth.isAuthenticated()).toBe(false);
  });
});
