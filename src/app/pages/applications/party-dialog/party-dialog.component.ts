import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-party-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './party-dialog.component.html',
  styleUrls: ['./party-dialog.component.css']
})
export class PartyDialogComponent {
  isOpen = input<boolean>(false);
  role = input<'applicant' | 'respondent'>('applicant');
  mode = input<'add' | 'edit'>('add');
  index = input<number>(-1);
  partyForm = input<FormGroup | null>(null);
  translatingFields = input<Set<string>>(new Set());
  lookupState = input<any>(null);
  stateLabel = input<string>('');
  occupations = input<any[]>([]);
  dialogError = input<string | null>(null);

  close = output<{ save: boolean }>();
  lookupPincode = output<void>();
  villageSelectionChange = output<void>();
  marathiFieldManualEdit = output<string>(); // Emits manual edited field name
}
