import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { VakaltnamaPanelComponent } from '../../../vakaltnama-panel/vakaltnama-panel.component';
import { Category1FilingService } from '../../services/category1-filing.service';

@Component({
  selector: 'app-vakaltnama-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, VakaltnamaPanelComponent],
  templateUrl: './vakaltnama-step.component.html',
  styleUrl: '../../category1-objection/category1-objection.component.css'
})
export class VakaltnamaStepComponent {
  protected readonly filing = inject(Category1FilingService);
}
