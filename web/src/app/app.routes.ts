import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
    title: 'Accesso · Gestione Ordini',
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
        title: 'Cruscotto · Gestione Ordini',
      },
      {
        path: 'ordini',
        loadComponent: () => import('./features/orders/order-list').then((m) => m.OrderList),
        title: 'Ordini · Gestione Ordini',
      },
      {
        path: 'ordini/nuovo',
        loadComponent: () => import('./features/orders/order-create').then((m) => m.OrderCreate),
        title: 'Nuovo ordine · Gestione Ordini',
      },
      {
        path: 'ordini/:id',
        loadComponent: () => import('./features/orders/order-detail').then((m) => m.OrderDetail),
        title: 'Ordine · Gestione Ordini',
      },
      {
        path: 'clienti',
        loadComponent: () => import('./features/customers/customer-list').then((m) => m.CustomerList),
        title: 'Clienti · Gestione Ordini',
      },
      {
        path: 'clienti/nuovo',
        loadComponent: () => import('./features/customers/customer-form').then((m) => m.CustomerForm),
        title: 'Nuovo cliente · Gestione Ordini',
      },
      {
        path: 'clienti/:id',
        loadComponent: () => import('./features/customers/customer-form').then((m) => m.CustomerForm),
        title: 'Cliente · Gestione Ordini',
      },
      {
        path: 'prodotti',
        loadComponent: () => import('./features/products/product-list').then((m) => m.ProductList),
        title: 'Prodotti · Gestione Ordini',
      },
      {
        path: 'magazzino',
        loadComponent: () => import('./features/inventory/inventory-list').then((m) => m.InventoryList),
        title: 'Magazzino · Gestione Ordini',
      },
      {
        path: 'notifiche',
        loadComponent: () => import('./features/notifications/notification-list').then((m) => m.NotificationList),
        title: 'Notifiche · Gestione Ordini',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
