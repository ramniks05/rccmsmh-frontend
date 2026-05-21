import { Component, AfterViewInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements AfterViewInit, OnDestroy {

  private observer: IntersectionObserver | null = null;

  /** Animate elements into view as they scroll into the viewport. */
  ngAfterViewInit(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal').forEach(el => {
      this.observer?.observe(el);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected readonly services = [
    {
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      title: 'Case Filing',
      titleMr: 'केस दाखल करणे',
      desc: 'File objections, mutations and revenue cases online from anywhere in Maharashtra.'
    },
    {
      icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
      title: 'Land Records',
      titleMr: 'जमीन नोंदी',
      desc: 'Access 7/12 extracts, property cards and urban mutation records instantly.'
    },
    {
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      title: 'Vakalatnama',
      titleMr: 'वकीलपत्र',
      desc: 'Generate official Marathi vakalatnama documents with digital advocate details.'
    },
    {
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      title: 'Case Tracking',
      titleMr: 'केस ट्रॅकिंग',
      desc: 'Track your case status, upcoming hearings and orders in real-time.'
    },
    {
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      title: 'Advocate Services',
      titleMr: 'वकील सेवा',
      desc: 'Manage bar council registration, assignments and your full case portfolio.'
    },
    {
      icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
      title: 'Secure Portal',
      titleMr: 'सुरक्षित पोर्टल',
      desc: 'Role-based access with JWT authentication and end-to-end encrypted data.'
    }
  ];

  protected readonly departments = [
    {
      name: 'Revenue Department',
      nameMr: 'महसूल विभाग',
      icon: '🏛️',
      desc: 'Land revenue, mutation processing and cadastral records management.'
    },
    {
      name: 'Land Records & Survey',
      nameMr: 'भूमी अभिलेख व सर्वेक्षण',
      icon: '🗺️',
      desc: 'Survey maps, 7/12 extracts and property card management across all talukas.'
    },
    {
      name: 'District Administration',
      nameMr: 'जिल्हा प्रशासन',
      icon: '🏢',
      desc: 'District-level revenue case oversight with collector office integration.'
    },
    {
      name: 'Citizen Service Centers',
      nameMr: 'नागरिक सेवा केंद्र',
      icon: '🤝',
      desc: 'In-person assistance at taluka and village level Seva Kendra offices.'
    }
  ];

  protected readonly stats = [
    { value: '24/7', label: 'Online Access',      labelMr: 'ऑनलाइन सेवा' },
    { value: '36',   label: 'Districts',           labelMr: 'जिल्हे'       },
    { value: '358',  label: 'Talukas',             labelMr: 'तालुके'       },
    { value: '100%', label: 'Secure & Encrypted',  labelMr: 'सुरक्षित'    }
  ];
}
