import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { TokenStorageService } from '../../services/token-storage.service';

@Component({
  selector: 'app-portal-home',
  imports: [RouterLink],
  templateUrl: './portal-home.component.html',
  styleUrl: './portal-home.component.css'
})
export class PortalHomeComponent {
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  protected readonly displayName = this.tokenStorage.getDisplayName() || 'User';
  protected readonly role = this.tokenStorage.getRole() || '-';

  constructor() {
    if (!this.tokenStorage.getAccessToken()) {
      void this.router.navigate(['/']);
    }
  }

  protected logout(): void {
    this.tokenStorage.clear();
    void this.router.navigate(['/']);
  }
}
