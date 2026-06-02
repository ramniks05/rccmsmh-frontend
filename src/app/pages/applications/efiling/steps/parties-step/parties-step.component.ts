import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { PartyDialogComponent } from '../../../party-dialog/party-dialog.component';
import { Category1FilingService } from '../../services/category1-filing.service';

@Component({
  selector: 'app-parties-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PartyDialogComponent],
  templateUrl: './parties-step.component.html',
  styleUrl: '../../category1-objection/category1-objection.component.css'
})
export class PartiesStepComponent {
  protected readonly filing = inject(Category1FilingService);
}
