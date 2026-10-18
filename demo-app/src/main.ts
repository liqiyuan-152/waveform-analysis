import { createApp } from 'vue'
import 'ant-design-vue/dist/reset.css'
import 'waveform-analysis/style.css'

import DemoRouterApp from './DemoRouterApp.vue'
import { router } from './router'
import './demoRoutes.css'
import './styles.css'
import './demo/colorPicker.css'

createApp(DemoRouterApp).use(router).mount('#app')

import './theme/tokens.css'
import './theme/analysis.css'
