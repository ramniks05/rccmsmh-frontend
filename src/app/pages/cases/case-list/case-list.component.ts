import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { TokenStorageService } from '../../../services/token-storage.service';

@Component({
  selector: 'app-case-list',
  imports: [RouterLink],
  templateUrl: './case-list.component.html',
  styleUrl: './case-list.component.css'
})
export class CaseListComponent {
  private readonly tokenStorage = inject(TokenStorageService);
  protected readonly role = this.tokenStorage.getRole() || '-';
}

