import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';

export interface FileUploadResponse {
  storageKey: string;
  fileName: string;
}

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  /** Upload before registration (public) or other flows; returns storage key for API payloads. */
  upload(file: File, category = 'advocate'): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return this.http
      .post<Record<string, unknown>>(`${this.apiBaseUrl}/api/files/upload`, formData)
      .pipe(map((body) => this.normalizeUploadResponse(body, file.name)));
  }

  private normalizeUploadResponse(body: Record<string, unknown>, fallbackName: string): FileUploadResponse {
    const storageKey = String(
      body['storageKey'] ?? body['storage_key'] ?? body['key'] ?? ''
    ).trim();
    const fileName = String(
      body['fileName'] ?? body['file_name'] ?? body['name'] ?? fallbackName
    ).trim();
    return { storageKey, fileName };
  }
}
