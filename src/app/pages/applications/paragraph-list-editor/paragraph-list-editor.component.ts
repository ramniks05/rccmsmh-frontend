import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-paragraph-list-editor',
  imports: [],
  templateUrl: './paragraph-list-editor.component.html',
  styleUrl: './paragraph-list-editor.component.css'
})
export class ParagraphListEditorComponent {
  readonly paragraphs = input<string[]>(['']);
  readonly paragraphsChange = output<string[]>();

  protected updateParagraph(index: number, value: string): void {
    const next = [...this.paragraphs()];
    next[index] = value;
    this.paragraphsChange.emit(next);
  }

  protected addParagraph(): void {
    this.paragraphsChange.emit([...this.paragraphs(), '']);
  }

  protected removeParagraph(index: number): void {
    const list = [...this.paragraphs()];
    if (list.length <= 1) {
      this.paragraphsChange.emit(['']);
      return;
    }
    list.splice(index, 1);
    this.paragraphsChange.emit(list);
  }

  protected canRemove(index: number): boolean {
    return this.paragraphs().length > 1 || !!this.paragraphs()[index]?.trim();
  }
}
