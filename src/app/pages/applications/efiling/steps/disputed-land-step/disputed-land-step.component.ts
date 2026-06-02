import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DisputedLandPanelComponent } from '../../../disputed-land-panel/disputed-land-panel.component';
import { Category1FilingService } from '../../services/category1-filing.service';

@Component({
  selector: 'app-disputed-land-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DisputedLandPanelComponent],
  templateUrl: './disputed-land-step.component.html',
  styleUrl: '../../category1-objection/category1-objection.component.css'
})
export class DisputedLandStepComponent {
  protected readonly filing = inject(Category1FilingService);
}
