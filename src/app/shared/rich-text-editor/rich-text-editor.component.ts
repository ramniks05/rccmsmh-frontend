import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  Input,
  ViewChild,
  signal
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  templateUrl: './rich-text-editor.component.html',
  styleUrl: './rich-text-editor.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true
    }
  ]
})
export class RichTextEditorComponent implements ControlValueAccessor, AfterViewInit {
  @ViewChild('surface', { static: true }) surfaceRef!: ElementRef<HTMLDivElement>;

  @Input() placeholder = 'Start typing…';
  @Input() minHeight = '280px';
  @Input() disabled = false;

  protected readonly focused = signal(false);

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private pendingHtml = '';

  ngAfterViewInit(): void {
    const el = this.surfaceRef?.nativeElement;
    if (el && this.pendingHtml && el.innerHTML !== this.pendingHtml) {
      el.innerHTML = this.pendingHtml;
    }
  }

  writeValue(value: string | null): void {
    this.pendingHtml = value ?? '';
    const el = this.surfaceRef?.nativeElement;
    if (el && el.innerHTML !== this.pendingHtml) {
      el.innerHTML = this.pendingHtml;
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onSurfaceInput(): void {
    const html = this.surfaceRef.nativeElement.innerHTML;
    this.pendingHtml = html;
    this.onChange(html);
  }

  protected onSurfaceBlur(): void {
    this.focused.set(false);
    this.onTouched();
  }

  protected onSurfaceFocus(): void {
    this.focused.set(true);
  }

  protected runCmd(command: string, value?: string): void {
    if (this.disabled) return;
    this.surfaceRef.nativeElement.focus();
    document.execCommand(command, false, value ?? undefined);
    this.onSurfaceInput();
  }

  protected insertParagraph(): void {
    this.runCmd('formatBlock', 'p');
  }

  protected clearFormatting(): void {
    this.runCmd('removeFormat');
    this.onSurfaceInput();
  }
}
