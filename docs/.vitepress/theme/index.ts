import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import HomeCompare from './HomeCompare.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  Layout() {
    // Render the "hard way vs. stripekit" comparison right after the hero,
    // above the feature grid.
    return h(DefaultTheme.Layout, null, {
      'home-hero-after': () => h(HomeCompare),
    })
  },
}
