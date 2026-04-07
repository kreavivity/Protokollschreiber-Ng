import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'start', pathMatch: 'full' },
  {
    path: 'start',
    loadComponent: () => import('./components/start/start.component').then(m => m.StartComponent)
  },
  {
    path: 'editor',
    loadComponent: () => import('./components/editor/editor.component').then(m => m.EditorComponent),
    children: [
      { path: '', redirectTo: 'protokoll', pathMatch: 'full' },
      {
        path: 'protokoll',
        loadComponent: () => import('./components/protokolldetails/protokolldetails.component').then(m => m.ProtokolldetailsComponent)
      },
      {
        path: 'pendenzen',
        loadComponent: () => import('./components/pendenzen/pendenzen.component').then(m => m.PendenzenComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'start' }
];
