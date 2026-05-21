import { Component, HostListener, inject } from '@angular/core';
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
  protected readonly currentYear = new Date().getFullYear();

  // Reactive signals — update instantly on login/logout
  protected readonly isLoggedIn = this.tokenStorage.isLoggedIn;
  protected readonly displayName = this.tokenStorage.sessionDisplayName;
  protected readonly role = this.tokenStorage.sessionRole;
  protected readonly designation = this.tokenStorage.sessionDesignation;
  protected readonly officeName = this.tokenStorage.sessionOfficeName;

  // Dropdown state
  protected showUserMenu = false;
  protected isLoggingOut = false;

  /** Derive 1–2 uppercase initials from a display name. */
  protected getInitials(name: string | null | undefined): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  protected toggleUserMenu(): void {
    this.showUserMenu = !this.showUserMenu;
  }

  protected closeUserMenu(): void {
    this.showUserMenu = false;
  }

  /** Close dropdown when clicking anywhere outside the user-menu wrapper. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu-wrapper')) {
      this.showUserMenu = false;
    }
  }

  protected logout(): void {
    this.isLoggingOut = true;
    this.authService
      .logout()
      .pipe(finalize(() => (this.isLoggingOut = false)))
      .subscribe({
        next: () => this.handlePostLogout(),
        error: () => this.handlePostLogout()
      });
  }

  private handlePostLogout(): void {
    this.tokenStorage.clear();
    this.showUserMenu = false;
    void this.router.navigate(['/']);
  }
}
