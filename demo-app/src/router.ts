import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import App from './App.vue'

export const routes: RouteRecordRaw[] = [
  { path: '/animation', name: 'animation', component: () => import('./views/AnimationDemo.vue') },
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
  {
    path: '/wasm-sampling',
    name: 'wasm-sampling',
    component: () => import('./views/WasmSamplingDemo.vue'),
  },
]

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
})
