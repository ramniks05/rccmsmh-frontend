import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Category1FilingService } from '../../services/category1-filing.service';

@Component({
  selector: 'app-act-section-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './act-section-step.component.html',
  styleUrl: '../../category1-objection/category1-objection.component.css'
})
export class ActSectionStepComponent {
  protected readonly filing = inject(Category1FilingService);
}
