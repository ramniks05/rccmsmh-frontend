import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { TokenStorageService } from '../services/token-storage.service';

const PUBLIC_PATHS = ['/api/auth/login', '/api/registrations', '/actuator/health', '/swagger-ui', '/v3/api-docs'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (PUBLIC_PATHS.some((path) => req.url.includes(path))) {
    return next(req);
  }

  const tokenStorage = inject(TokenStorageService);
  const accessToken = tokenStorage.getAccessToken();

  if (!accessToken) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${accessToken}`
      }
    })
  );
};
