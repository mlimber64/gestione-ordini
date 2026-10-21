import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from './auth.service';
import { fakeJwt } from './testing';
import { authGuard, guestGuard, roleGuard } from './guards';

describe('guardie di rotta', () => {
  let auth: AuthService;

  const run = (guard: typeof authGuard) =>
    TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
  });

  const signIn = (role: string) => auth.accessToken.set(fakeJwt({ sub: 'anna', roles: [role] }));

  it('chi non è autenticato viene mandato al login', () => {
    const result = run(authGuard) as UrlTree;
    expect(result.toString()).toBe('/login');
  });

  it('chi è autenticato entra nelle schermate private', () => {
    signIn('VIEWER');
    expect(run(authGuard)).toBe(true);
  });

  it('chi è già dentro non rivede il login', () => {
    expect(run(guestGuard)).toBe(true);
    signIn('OPERATOR');
    expect((run(guestGuard) as UrlTree).toString()).toBe('/');
  });

  it('una rotta riservata agli amministratori respinge gli altri ruoli', () => {
    signIn('OPERATOR');
    expect((run(roleGuard('ADMIN')) as UrlTree).toString()).toBe('/');
    signIn('ADMIN');
    expect(run(roleGuard('ADMIN'))).toBe(true);
  });
});
