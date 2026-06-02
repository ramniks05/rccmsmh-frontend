import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Category1FilingService } from '../../services/category1-filing.service';

@Component({
  selector: 'app-disputed-order-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './disputed-order-step.component.html',
  styleUrl: './disputed-order-step.component.css'
})
export class DisputedOrderStepComponent {
  protected readonly filing = inject(Category1FilingService);
}
