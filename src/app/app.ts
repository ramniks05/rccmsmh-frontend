import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from './services/auth.service';
import { TokenStorageService } from './services/token-storage.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly authService = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  protected readonly appName = 'RCCMS Maharashtra';
  protected showUserMenu = false;
  protected isLoggingOut = false;

  protected get isLoggedIn(): boolean {
    return !!this.tokenStorage.getAccessToken();
  }

  protected get displayName(): string {
    return this.tokenStorage.getDisplayName() || 'User';
  }

  protected get userRole(): string {
    return this.tokenStorage.getRole() || '';
  }

  protected toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  protected closeUserMenu(): void {
    this.showUserMenu = false;
  }

  protected logout(): void {
    this.isLoggingOut = true;
    this.authService
      .logout()
      .pipe(finalize(() => (this.isLoggingOut = false)))
      .subscribe({
        next: () => {
          this.tokenStorage.clear();
          this.showUserMenu = false;
          void this.router.navigate(['/']);
        },
        error: () => {
          // Clear token even if logout API fails
          this.tokenStorage.clear();
          this.showUserMenu = false;
          void this.router.navigate(['/']);
        }
      });
  }
}
