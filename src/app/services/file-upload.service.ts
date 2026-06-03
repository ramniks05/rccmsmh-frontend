import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';

import {
  FILE_UPLOAD_MAX_BYTES,
  FILING_ATTACHMENT_UPLOAD_CATEGORY,
  RCCMS_API
} from '../core/rccms-api.paths';
import { environment } from '../../environments/environment';

export { FILE_UPLOAD_MAX_BYTES, FILING_ATTACHMENT_UPLOAD_CATEGORY };

export interface FileUploadResponse {
  storageKey: string;
  fileName: string;
  mimeType: string;
  size?: number;
}

export interface FileDownloadOptions {
  fileName?: string;
  /** true = open in browser; false = download attachment (default). */
  inline?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  /** POST /api/files/upload — no auth required. */
  upload(file: File, category = 'advocate'): Observable<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    return this.http
      .post<Record<string, unknown>>(`${this.apiBaseUrl}${RCCMS_API.files.upload}`, formData)
      .pipe(map((body) => this.normalizeUploadResponse(body, file)));
  }

  /** GET /api/files/download — Bearer JWT required. */
  download(storageKey: string, options?: FileDownloadOptions): Observable<Blob> {
    const key = storageKey.trim().replace(/^\//, '');
    if (!key) {
      return throwError(() => new Error('storageKey is required.'));
    }
    let params = new HttpParams().set('storageKey', key);
    const fileName = options?.fileName?.trim();
    if (fileName) {
      params = params.set('fileName', fileName);
    }
    if (options?.inline === true) {
      params = params.set('inline', 'true');
    } else if (options?.inline === false) {
      params = params.set('inline', 'false');
    }
    return this.http.get(`${this.apiBaseUrl}${RCCMS_API.files.download}`, {
      params,
      responseType: 'blob'
    });
  }

  buildDownloadApiUrl(storageKey: string, options?: FileDownloadOptions): string {
    const key = storageKey.trim().replace(/^\//, '');
    const search = new URLSearchParams({ storageKey: key });
    const fileName = options?.fileName?.trim();
    if (fileName) search.set('fileName', fileName);
    if (options?.inline === true) search.set('inline', 'true');
    else if (options?.inline === false) search.set('inline', 'false');
    return `${this.apiBaseUrl}${RCCMS_API.files.download}?${search.toString()}`;
  }

  private normalizeUploadResponse(body: Record<string, unknown>, file: File): FileUploadResponse {
    const storageKey = String(
      body['storageKey'] ?? body['storage_key'] ?? body['key'] ?? ''
    ).trim();
    const fileName = String(
      body['fileName'] ?? body['file_name'] ?? body['name'] ?? file.name
    ).trim();
    const mimeType = String(
      body['mimeType'] ?? body['mime_type'] ?? file.type ?? 'application/octet-stream'
    ).trim();
    const sizeRaw = body['size'];
    const size =
      typeof sizeRaw === 'number' && Number.isFinite(sizeRaw)
        ? sizeRaw
        : file.size > 0
          ? file.size
          : undefined;
    return { storageKey, fileName, mimeType, size };
  }
}
