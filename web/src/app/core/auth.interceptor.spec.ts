import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { fakeJwt } from './auth.service.spec';
import { AuthService } from './auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;

  const pair = (name: string) => ({
    accessToken: fakeJwt({ sub: name, roles: ['ADMIN'] }),
    refreshToken: 'refresh-' + name,
    tokenType: 'Bearer',
    expiresIn: 900,
  });

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'login', children: [] }]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    auth.login('anna', 'p').subscribe();
    controller.expectOne('/api/v1/auth/login').flush(pair('vecchio'));
  });

  afterEach(() => controller.verify());

  it('aggiunge il token alle chiamate API', () => {
    http.get('/api/v1/orders').subscribe();
    const request = controller.expectOne('/api/v1/orders');
    expect(request.request.headers.get('Authorization')).toBe('Bearer ' + auth.accessToken());
    request.flush({});
  });

  it('non aggiunge il token alle chiamate di autenticazione né a quelle esterne', () => {
    http.post('/api/v1/auth/refresh', {}).subscribe();
    expect(controller.expectOne('/api/v1/auth/refresh').request.headers.has('Authorization')).toBe(false);
    http.get('https://esempio.it/dati').subscribe();
    expect(controller.expectOne('https://esempio.it/dati').request.headers.has('Authorization')).toBe(false);
  });

  it('su 401 chiede un token nuovo e ripete la richiesta una volta', () => {
    let body: unknown;
    http.get('/api/v1/orders').subscribe((value) => (body = value));
    controller.expectOne('/api/v1/orders').flush({}, { status: 401, statusText: 'Unauthorized' });

    controller.expectOne('/api/v1/auth/refresh').flush(pair('nuovo'));
    const retry = controller.expectOne('/api/v1/orders');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer ' + auth.accessToken());
    expect(auth.user()?.username).toBe('nuovo');
    retry.flush({ ok: true });

    expect(body).toEqual({ ok: true });
  });

  it('se anche il refresh fallisce chiude la sessione e propaga l\'errore', () => {
    let status = 0;
    http.get('/api/v1/orders').subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/v1/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne('/api/v1/auth/refresh').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('gli altri errori passano senza tentare il refresh', () => {
    let status = 0;
    http.get('/api/v1/orders').subscribe({ error: (e) => (status = e.status) });
    controller.expectOne('/api/v1/orders').flush({}, { status: 422, statusText: 'Unprocessable' });

    expect(status).toBe(422);
    controller.expectNone('/api/v1/auth/refresh');
  });
});
