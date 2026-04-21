import { Routes } from '@angular/router';
import { AdvocateRegistrationComponent } from './pages/advocate-registration/advocate-registration.component';
import { HomeComponent } from './pages/home/home.component';
import { PartyRegistrationComponent } from './pages/party-registration/party-registration.component';
import { PortalHomeComponent } from './pages/portal-home/portal-home.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'portal-home', component: PortalHomeComponent },
  { path: 'register/advocate', component: AdvocateRegistrationComponent },
  { path: 'register/party', component: PartyRegistrationComponent },
  { path: '**', redirectTo: '' }
];
