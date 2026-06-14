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
      VBtn: { rounded: 'md' },
      VCard: { rounded: 'md' },
      VTextField: { variant: 'outlined', density: 'comfortable' },
      VSelect: { variant: 'outlined', density: 'comfortable' },
      VTextarea: { variant: 'outlined', density: 'comfortable' },
      VAutocomplete: { variant: 'outlined', density: 'comfortable' },
      VCombobox: { variant: 'outlined', density: 'comfortable' },
      VDataTable: { density: 'comfortable' }
    },
    theme: {
      defaultTheme: 'mbpLight',
      themes: {
        mbpLight: {
          dark: false,
          colors: {
            background: '#F6F7F9',
            surface: '#FFFFFF',
            'surface-variant': '#EEF1F5',
            'on-surface-variant': '#1F2937',
            primary: '#1E3A8A',
            'on-primary': '#FFFFFF',
            secondary: '#475569',
            accent: '#0EA5E9',
            success: '#16A34A',
            info: '#2563EB',
            warning: '#D97706',
            error: '#DC2626'
          }
        },
        mbpConsole: {
          dark: true,
          colors: {
            background: '#0F172A',
            surface: '#1E293B',
            'surface-variant': '#334155',
            'on-surface-variant': '#E2E8F0',
            primary: '#60A5FA',
            'on-primary': '#0F172A',
            secondary: '#94A3B8',
            accent: '#22D3EE',
            success: '#4ADE80',
            info: '#38BDF8',
            warning: '#FBBF24',
            error: '#F87171'
          }
        }
      }
    }
  })
  nuxtApp.vueApp.use(vuetify)
})
