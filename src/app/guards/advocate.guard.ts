import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { TokenStorageService } from '../services/token-storage.service';

/** Allow route only when the user is logged in as an Advocate (use after authGuard). */
export const advocateGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (tokenStorage.isAdvocate()) {
    return true;
  }

  return router.createUrlTree(['/portal-home']);
};
