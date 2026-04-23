import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OriginalFileMutationComponent } from '../original-file-mutation/original-file-mutation.component';

type ApplicationType = 'ORIGINAL_FILE_MUTATION';

@Component({
  selector: 'app-new-application',
  imports: [RouterLink, OriginalFileMutationComponent],
  templateUrl: './new-application.component.html',
  styleUrl: './new-application.component.css'
})
export class NewApplicationComponent {
  protected readonly selectedType = signal<ApplicationType | ''>('');

  protected readonly title = computed(() => {
    if (this.selectedType() === 'ORIGINAL_FILE_MUTATION') return 'Original File (Mutation)';
    return 'New Application';
  });
}

