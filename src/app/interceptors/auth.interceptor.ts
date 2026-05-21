import {
  HttpInterceptorFn,
  HttpErrorResponse
} from '@angular/common/http';

import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { TokenStorageService } from '../services/token-storage.service';

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/registrations',
  '/actuator/health',
  '/swagger-ui',
  '/v3/api-docs',

  // External translation APIs (NO AUTH HEADER)
  'translate.googleapis.com',
  'translate.google.com'
];

export const authInterceptor: HttpInterceptorFn = (
  req,
  next
) => {

  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => req.url.includes(path)
  );

  // Add token only for protected backend APIs
  if (!isPublicPath) {

    const accessToken =
      tokenStorage.getAccessToken();

    if (accessToken) {
      req = req.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`
        }
      });
    }
  }

  return next(req).pipe(
    catchError((error: unknown) => {

      if (error instanceof HttpErrorResponse) {

        // 401 → token expired/invalid
        if (error.status === 401) {
          tokenStorage.clear();
          void router.navigate(['/login']);
        }

        // 403 → forbidden
        if (error.status === 403) {
          void router.navigate(['/portal-home']);
        }
      }

      return throwError(() => error);
    })
  );
};
