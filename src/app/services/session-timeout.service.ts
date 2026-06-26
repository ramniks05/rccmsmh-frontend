import { DestroyRef, Injectable, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

import { TokenStorageService } from './token-storage.service';

/** Logs the user out when the JWT expires or an expired token is detected. */
@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private expiryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onVisibilityChange = (): void => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    this.ensureValidSessionOrLogout();
    if (this.tokenStorage.isLoggedIn()) {
      this.scheduleExpiryLogout();
    }
  };

  constructor() {
    effect(() => {
      if (this.tokenStorage.isLoggedIn()) {
        this.ensureValidSessionOrLogout();
        this.scheduleExpiryLogout();
      } else {
        this.clearExpiryTimer();
      }
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.ensureValidSessionOrLogout());

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.destroyRef.onDestroy(() =>
        document.removeEventListener('visibilitychange', this.onVisibilityChange)
      );
    }

    this.ensureValidSessionOrLogout();
    if (this.tokenStorage.isLoggedIn()) {
      this.scheduleExpiryLogout();
    }
  }

  /** Clear session and redirect when token is past expiry. */
  forceLogout(): void {
    this.clearExpiryTimer();
    if (!this.tokenStorage.getAccessToken()) return;

    this.tokenStorage.clear();

    const path = this.router.url.split('?')[0] || '/';
    if (path === '/' || path === '/login' || path.startsWith('/register/')) {
      return;
    }

    void this.router.navigate(['/login'], { queryParams: { sessionExpired: '1' } });
  }

  private ensureValidSessionOrLogout(): void {
    if (!this.tokenStorage.getAccessToken()) return;
    if (this.tokenStorage.isSessionExpired()) {
      this.forceLogout();
    }
  }

  private scheduleExpiryLogout(): void {
    this.clearExpiryTimer();

    const expMs = this.tokenStorage.getTokenExpiresAtMs();
    if (expMs === null) return;

    const delay = expMs - Date.now();
    if (delay <= 0) {
      this.forceLogout();
      return;
    }

    this.expiryTimer = setTimeout(() => this.forceLogout(), delay);
  }

  private clearExpiryTimer(): void {
    if (this.expiryTimer !== null) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
  }
}
