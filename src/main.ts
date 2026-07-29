import { createApp } from 'vue'
import 'ant-design-vue/dist/antd.css'

import DemoRouterApp from './DemoRouterApp.vue'
import { router } from './router'
import './demoRoutes.css'
import './styles.css'

createApp(DemoRouterApp).use(router).mount('#app')
