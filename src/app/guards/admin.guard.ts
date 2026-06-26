import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { TokenStorageService } from '../services/token-storage.service';
import { SessionTimeoutService } from '../services/session-timeout.service';

export const adminGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const sessionTimeout = inject(SessionTimeoutService);
  const router = inject(Router);

  if (!tokenStorage.hasValidSession()) {
    if (tokenStorage.getAccessToken()) {
      sessionTimeout.forceLogout();
      return router.createUrlTree(['/login'], { queryParams: { sessionExpired: '1' } });
    }
    return router.createUrlTree(['/']);
  }

  const role = tokenStorage.getRole();
  if (role === 'ADMIN') {
    return true;
  }

  return router.createUrlTree(['/portal-home']);
};

