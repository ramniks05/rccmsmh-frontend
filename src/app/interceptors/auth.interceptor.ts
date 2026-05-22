import {
  HttpInterceptorFn,
  HttpErrorResponse
} from '@angular/common/http';

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { TokenStorageService } from '../services/token-storage.service';

/** Never attach Authorization (public registration / login / master lookups for signup). */
const NO_AUTH_PATHS = [
  '/api/auth/login',
  '/api/registrations',
  '/api/files/upload',
  '/api/lookups/states',
  '/api/lookups/districts',
  '/api/lookups/pincode-details',
  '/actuator/health',
  '/swagger-ui',
  '/v3/api-docs',
  'translate.googleapis.com',
  'translate.google.com'
];

/** Routes that must not be interrupted by global 401/403 redirects. */
function isPublicAppRoute(url: string): boolean {
  const path = url.split('?')[0] || '/';
  return path === '/' || path === '/login' || path.startsWith('/register/');
}

export const authInterceptor: HttpInterceptorFn = (
  req,
  next
) => {

  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  const skipAuth = NO_AUTH_PATHS.some((path) => req.url.includes(path));
  const accessToken = tokenStorage.getAccessToken();

  // Attach JWT when present (lookups work for logged-in users; registration APIs stay public)
  if (!skipAuth && accessToken) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: unknown) => {

      if (error instanceof HttpErrorResponse) {

        // 401 → token expired/invalid (do not hijack public registration/home)
        if (error.status === 401) {
          tokenStorage.clear();
          if (!isPublicAppRoute(router.url)) {
            void router.navigate(['/login']);
          }
        }

        // 403 → forbidden (allow registration pages to render)
        if (error.status === 403) {
          if (!isPublicAppRoute(router.url)) {
            void router.navigate(['/portal-home']);
          }
        }
      }

      return throwError(() => error);
    })
  );
};
