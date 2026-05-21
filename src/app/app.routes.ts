import { Routes } from '@angular/router';
import { AdvocateRegistrationComponent } from './pages/advocate-registration/advocate-registration.component';
import { AdminMastersComponent } from './pages/admin/admin-masters/admin-masters.component';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { PartyRegistrationComponent } from './pages/party-registration/party-registration.component';
import { PortalHomeComponent } from './pages/portal-home/portal-home.component';
import { NewApplicationComponent } from './pages/applications/new-application/new-application.component';
import { CaseListComponent } from './pages/cases/case-list/case-list.component';
import { NewCaseComponent } from './pages/cases/new-case/new-case.component';
import { ApplicationPreviewComponent } from './pages/applications/application-preview/application-preview.component';
import { MyApplicationsComponent } from './pages/applications/my-applications/my-applications.component';

import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';
import { advocateGuard } from './guards/advocate.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'portal-home', component: PortalHomeComponent, canActivate: [authGuard] },
  { path: 'cases', component: CaseListComponent, canActivate: [authGuard] },
  { path: 'cases/new', component: NewCaseComponent, canActivate: [authGuard, advocateGuard] },
  { path: 'applications', component: MyApplicationsComponent, canActivate: [authGuard] },
  { path: 'applications/new', component: NewApplicationComponent, canActivate: [authGuard, advocateGuard] },
  { path: 'applications/:id', component: ApplicationPreviewComponent, canActivate: [authGuard] },
  { path: 'admin/masters', component: AdminMastersComponent, canActivate: [adminGuard] },
  { path: 'register/advocate', component: AdvocateRegistrationComponent },
  { path: 'register/party', component: PartyRegistrationComponent },
  { path: '**', redirectTo: '' }
];
