import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import App from './App.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'workspace',
    component: App,
  },
  {
    path: '/fixed-y-domain',
    name: 'fixed-y-domain',
    component: () => import('./views/FixedYDomainDemo.vue'),
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
