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
import {
  advocateProfileCompleteGuard,
  advocateProfilePageGuard
} from './guards/advocate-profile-complete.guard';
import { AdvocateProfileComponent } from './pages/advocate-profile/advocate-profile.component';
import { AdvocateMyProfileComponent } from './pages/advocate-my-profile/advocate-my-profile.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'register/advocate', component: AdvocateRegistrationComponent },
  { path: 'register/party', component: PartyRegistrationComponent },
  {
    path: 'advocate/my-profile',
    component: AdvocateMyProfileComponent,
    canActivate: [authGuard, advocateGuard]
  },
  {
    path: 'advocate/profile',
    component: AdvocateProfileComponent,
    canActivate: [authGuard, advocateGuard, advocateProfilePageGuard]
  },
  {
    path: 'advocate/profile/edit',
    component: AdvocateProfileComponent,
    canActivate: [authGuard, advocateGuard]
  },
  {
    path: 'portal-home',
    component: PortalHomeComponent,
    canActivate: [authGuard, advocateProfileCompleteGuard]
  },
  { path: 'cases', component: CaseListComponent, canActivate: [authGuard] },
  {
    path: 'cases/new',
    component: NewCaseComponent,
    canActivate: [authGuard, advocateGuard, advocateProfileCompleteGuard]
  },
  {
    path: 'applications',
    component: MyApplicationsComponent,
    canActivate: [authGuard, advocateProfileCompleteGuard]
  },
  {
    path: 'applications/new',
    component: NewApplicationComponent,
    canActivate: [authGuard, advocateGuard, advocateProfileCompleteGuard]
  },
  {
    path: 'applications/:id',
    component: ApplicationPreviewComponent,
    canActivate: [authGuard, advocateProfileCompleteGuard]
  },
  { path: 'admin/masters', component: AdminMastersComponent, canActivate: [adminGuard] },
  { path: '**', redirectTo: '' }
];
