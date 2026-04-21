import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';

export type HealthStatus = 'idle' | 'loading' | 'success' | 'error';

interface HealthResponse {
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackendService {
  private readonly http = inject(HttpClient);

  getHealthStatus(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${environment.apiBaseUrl}/actuator/health`);
  }
}
