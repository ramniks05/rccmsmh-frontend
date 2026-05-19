import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { TokenStorageService } from '../../services/token-storage.service';

@Component({
  selector: 'app-portal-home',
  imports: [RouterLink],
  templateUrl: './portal-home.component.html',
  styleUrl: './portal-home.component.css'
})
export class PortalHomeComponent {
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  protected readonly displayName = this.tokenStorage.getDisplayName() || 'User';
  protected readonly role = this.tokenStorage.getRole() || '-';
  /** File New Case is available only when logged in as Advocate. */
  protected readonly isAdvocate = this.tokenStorage.isAdvocate();
  protected isLoggingOut = false;

  constructor() {
    if (!this.tokenStorage.getAccessToken()) {
      void this.router.navigate(['/']);
    }
  }

  protected logout(): void {
    this.isLoggingOut = true;
    this.authService
      .logout()
      .pipe(finalize(() => (this.isLoggingOut = false)))
      .subscribe({
        next: () => {
          this.tokenStorage.clear();
          void this.router.navigate(['/']);
        },
        error: () => {
          // Clear token even if logout API fails
          this.tokenStorage.clear();
          void this.router.navigate(['/']);
        }
      });
  }
}
