import { createApp } from 'vue'

import App from './ui/App.vue'
import './ui/assets/main.css'
import { isLightMode } from './theme'

document.documentElement.classList.toggle('light-mode', isLightMode)

createApp(App).mount('#app')
