import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { TokenStorageService } from '../services/token-storage.service';

export const adminGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (!tokenStorage.getAccessToken()) {
    return router.createUrlTree(['/']);
  }

  const role = tokenStorage.getRole();
  if (role === 'ADMIN') {
    return true;
  }

  return router.createUrlTree(['/portal-home']);
};

