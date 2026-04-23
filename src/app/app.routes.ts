import { Routes } from '@angular/router';
import { AdvocateRegistrationComponent } from './pages/advocate-registration/advocate-registration.component';
import { AdminMastersComponent } from './pages/admin/admin-masters/admin-masters.component';
import { HomeComponent } from './pages/home/home.component';
import { PartyRegistrationComponent } from './pages/party-registration/party-registration.component';
import { PortalHomeComponent } from './pages/portal-home/portal-home.component';
import { NewApplicationComponent } from './pages/applications/new-application/new-application.component';

import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'portal-home', component: PortalHomeComponent },
  { path: 'applications/new', component: NewApplicationComponent },
  { path: 'admin/masters', component: AdminMastersComponent, canActivate: [adminGuard] },
  { path: 'register/advocate', component: AdvocateRegistrationComponent },
  { path: 'register/party', component: PartyRegistrationComponent },
  { path: '**', redirectTo: '' }
];
