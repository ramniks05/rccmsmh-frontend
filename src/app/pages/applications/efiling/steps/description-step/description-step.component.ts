import { Component, inject, viewChild } from '@angular/core';
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
  styleUrl: '../../category1-objection/category1-objection.component.css'
})
export class DescriptionStepComponent {
  protected readonly filing = inject(Category1FilingService);
  public readonly mappedDocsPanel = viewChild(MappedDocumentsPanelComponent);
}
