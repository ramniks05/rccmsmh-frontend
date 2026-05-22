import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { TokenStorageService } from '../services/token-storage.service';

/** Redirect advocates with incomplete profile to profile completion page. */
export const advocateProfileCompleteGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (!tokenStorage.isAdvocate()) {
    return true;
  }
  if (tokenStorage.isProfileComplete()) {
    return true;
  }
  return router.createUrlTree(['/advocate/profile']);
};

/** Profile page only when advocate profile is not yet complete. */
export const advocateProfilePageGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorageService);
  const router = inject(Router);

  if (!tokenStorage.isAdvocate()) {
    return router.createUrlTree(['/portal-home']);
  }
  if (tokenStorage.isProfileComplete()) {
    return router.createUrlTree(['/advocate/my-profile']);
  }
  return true;
};
