import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { es } from 'vuetify/locale'

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    components,
    directives,
    locale: { locale: 'es', messages: { es } },
    defaults: {
      VBtn: { rounded: 'md', style: 'text-transform: none; letter-spacing: 0.02em;' },
      VCard: { rounded: 'lg' },
      VTextField: { variant: 'outlined', density: 'comfortable' },
      VSelect: { variant: 'outlined', density: 'comfortable' },
      VTextarea: { variant: 'outlined', density: 'comfortable' },
      VAutocomplete: { variant: 'outlined', density: 'comfortable' },
      VCombobox: { variant: 'outlined', density: 'comfortable' }
    },
    theme: {
      defaultTheme: 'cyber',
      themes: {
        cyber: {
          dark: true,
          colors: {
            background: '#0B0F14',
            surface: '#11171F',
            'surface-variant': '#1E293B',
            'surface-bright': '#1A2332',
            primary: '#22D3EE',
            'on-primary': '#0B0F14',
            secondary: '#64748B',
            'on-secondary': '#E2E8F0',
            accent: '#A78BFA',
            success: '#34D399',
            info: '#38BDF8',
            warning: '#FBBF24',
            error: '#F87171',
            'on-background': '#E2E8F0',
            'on-surface': '#E2E8F0'
          },
          variables: {
            'border-color': '#1E293B',
            'border-opacity': 1,
            'high-emphasis-opacity': 1,
            'medium-emphasis-opacity': 0.78,
            'disabled-opacity': 0.45,
            'theme-overlay-multiplier': 1.5
          }
        }
      }
    }
  })
  nuxtApp.vueApp.use(vuetify)
})
