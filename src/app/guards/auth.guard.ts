import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { TokenStorageService } from '../services/token-storage.service';
import { SessionTimeoutService } from '../services/session-timeout.service';

export const authGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const sessionTimeout = inject(SessionTimeoutService);
  const router = inject(Router);

  if (tokenStorage.hasValidSession()) {
    return true;
  }

  if (tokenStorage.getAccessToken()) {
    sessionTimeout.forceLogout();
    return router.createUrlTree(['/login'], { queryParams: { sessionExpired: '1' } });
  }

  return router.createUrlTree(['/']);
};

