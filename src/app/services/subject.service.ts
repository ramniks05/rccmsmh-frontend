import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export interface SubjectRecord {
  id: number;
  departmentId: number;
  departmentName: string | null;
  departmentLocalName: string | null;
  subjectCode: string;
  subjectName: string;
  subjectNameLocal: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class SubjectService {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = environment.apiBaseUrl;

  listSubjects(departmentId?: number): Observable<SubjectRecord[]> {
    return this.http.get<SubjectRecord[]>(`${this.apiBaseUrl}/api/subjects`, {
      params: departmentId ? { departmentId } : {}
    });
  }

  getSubject(id: number): Observable<SubjectRecord> {
    return this.http.get<SubjectRecord>(`${this.apiBaseUrl}/api/subjects/${id}`);
  }
}

