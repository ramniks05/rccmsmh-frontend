import { Component, inject, OnInit, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { ParagraphListEditorComponent } from '../../../paragraph-list-editor/paragraph-list-editor.component';
import { MappedDocumentsPanelComponent } from '../../../mapped-documents-panel/mapped-documents-panel.component';
import { Category1FilingService } from '../../services/category1-filing.service';

@Component({
  selector: 'app-description-step',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ParagraphListEditorComponent, MappedDocumentsPanelComponent],
  templateUrl: './description-step.component.html',
  styleUrl: './description-step.component.css'
})
export class DescriptionStepComponent implements OnInit {
  protected readonly filing = inject(Category1FilingService);
  public readonly mappedDocsPanel = viewChild(MappedDocumentsPanelComponent);

  ngOnInit(): void {
    // Run after view init so applicant/vakaltnama data is available; do not wait on hydrating.
    queueMicrotask(() => this.filing.ensureDescriptionTemplates());
    setTimeout(() => {
      if (!this.filing.prayerTemplateHtml().trim()) {
        this.filing.loadPrayerTemplate(false);
      }
      if (!this.filing.affidavitTemplateHtml().trim()) {
        this.filing.loadAffidavitTemplate(false);
      }
    }, 0);
  }

  protected hasAffidavitPreview(): boolean {
    return this.filing.affidavitTemplateHtml().trim().length > 0;
  }

  protected hasPrayerPreview(): boolean {
    return this.filing.prayerTemplateHtml().trim().length > 0;
  }
}
