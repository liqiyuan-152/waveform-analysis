import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/controls', redirect: '/controls/input-number' },
  {
    path: '/controls/input-number',
    name: 'controls-input-number',
    component: () => import('./views/controls/InputNumberDemo.vue'),
  },
  {
    path: '/controls/select',
    name: 'controls-select',
    component: () => import('./views/controls/SelectDemo.vue'),
  },
  {
    path: '/controls/color-picker',
    name: 'controls-color-picker',
    component: () => import('./views/controls/ColorPickerDemo.vue'),
  },
  {
    path: '/controls/pagination',
    name: 'controls-pagination',
    component: () => import('./views/controls/PaginationDemo.vue'),
  },
  {
    path: '/controls/modal',
    name: 'controls-modal',
    component: () => import('./views/controls/ModalDemo.vue'),
  },
  {
    path: '/controls/popup',
    name: 'controls-popup',
    component: () => import('./views/controls/PopupDemo.vue'),
  },
  { path: '/display', name: 'display', component: () => import('./views/DisplayDemo.vue') },
  {
    path: '/components',
    redirect: '/',
  },
  { path: '/animation', name: 'animation', component: () => import('./views/AnimationDemo.vue') },
  {
    path: '/',
    name: 'workspace',
    component: () => import('./App.vue'),
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
