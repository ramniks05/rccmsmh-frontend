import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { TokenStorageService } from '../services/token-storage.service';

const PUBLIC_PATHS = ['/api/auth/login', '/api/registrations', '/actuator/health', '/swagger-ui', '/v3/api-docs'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isPublicPath = PUBLIC_PATHS.some((path) => req.url.includes(path));

  // Clone and add Authorization header for protected endpoints
  if (!isPublicPath) {
    const tokenStorage = inject(TokenStorageService);
    const accessToken = tokenStorage.getAccessToken();

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
        const tokenStorage = inject(TokenStorageService);
        const router = inject(Router);

        // Handle 401 Unauthorized - token expired or invalid
        if (error.status === 401) {
          tokenStorage.clear();
          void router.navigate(['/login']);
        }

        // Handle 403 Forbidden - user doesn't have permission
        if (error.status === 403) {
          void router.navigate(['/portal-home']);
        }
      }

      return throwError(() => error);
    })
  );
};
