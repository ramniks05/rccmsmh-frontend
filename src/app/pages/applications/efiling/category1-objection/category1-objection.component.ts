import { Component, effect, inject, input } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { DisputedOrderStepComponent } from '../steps/disputed-order-step/disputed-order-step.component';
import { DisputedLandStepComponent } from '../steps/disputed-land-step/disputed-land-step.component';
import { ActSectionStepComponent } from '../steps/act-section-step/act-section-step.component';
import { PartiesStepComponent } from '../steps/parties-step/parties-step.component';
import { VakaltnamaStepComponent } from '../steps/vakaltnama-step/vakaltnama-step.component';
import { DescriptionStepComponent } from '../steps/description-step/description-step.component';
import { ApplicationPreviewComponent } from '../../application-preview/application-preview.component';
import { Category1FilingService } from '../services/category1-filing.service';

@Component({
  selector: 'app-category1-objection',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DisputedOrderStepComponent,
    DisputedLandStepComponent,
    ActSectionStepComponent,
    PartiesStepComponent,
    VakaltnamaStepComponent,
    DescriptionStepComponent,
    ApplicationPreviewComponent
  ],
  providers: [Category1FilingService],
  templateUrl: './category1-objection.component.html',
  styleUrl: './category1-objection.component.css'
})
export class Category1ObjectionComponent {
  caseCategoryId = input.required<number>();
  resumeApplicationId = input<number | null>(null);
  protected readonly filing = inject(Category1FilingService);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    effect(() => {
      const catId = this.caseCategoryId();
      let resumeId = Number(this.resumeApplicationId() ?? 0);
      if (resumeId < 1) {
        resumeId = Number(this.route.snapshot.queryParamMap.get('applicationId') ?? 0);
      }
      this.filing.init(catId, resumeId > 0 ? resumeId : undefined);
    });
  }
}
