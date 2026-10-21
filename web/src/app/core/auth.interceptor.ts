import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const isApi = (url: string) => url.startsWith('/api/');
const isAuthCall = (url: string) => url.startsWith('/api/v1/auth/');

const withToken = (req: HttpRequest<unknown>, token: string) =>
  req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

/**
 * Aggiunge il token alle chiamate API. Se il server risponde 401 (token scaduto) ne chiede uno nuovo una sola volta
 * e ripete la richiesta; se anche questo fallisce, chiude la sessione.
 */
export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  if (!isApi(req.url) || isAuthCall(req.url) || !token) return next(req);

  return next(withToken(req, token)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) return throwError(() => error);
      return auth.refresh().pipe(
        switchMap((fresh) => next(withToken(req, fresh))),
        catchError((refreshError) => {
          auth.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
