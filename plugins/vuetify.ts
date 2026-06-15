import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { es } from 'vuetify/locale'

const brand = {
  navy: '#1E3A8A',
  blue: '#2563EB',
  cyan: '#22D3EE',
  green: '#22C55E'
}

const status = {
  success: '#16A34A',
  warning: '#F59E0B',
  error: '#DC2626',
  info: '#2563EB',
  neutral: '#64748B'
}

const mbpLight = {
  dark: false,
  colors: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-light': '#F1F5F9',
    'surface-variant': '#E2E8F0',
    'on-surface-variant': '#0F172A',
    'on-background': '#0F172A',
    'on-surface': '#0F172A',
    primary: brand.navy,
    'on-primary': '#FFFFFF',
    'primary-darken-1': '#172554',
    secondary: brand.blue,
    'on-secondary': '#FFFFFF',
    accent: brand.green,
    'on-accent': '#FFFFFF',
    success: status.success,
    info: status.info,
    warning: status.warning,
    error: status.error,
    'status-neutral': status.neutral,
    'status-success': status.success,
    'status-warning': status.warning,
    'status-error': status.error
  }
}

const mbpDark = {
  dark: true,
  colors: {
    background: '#0B1220',
    surface: '#101827',
    'surface-bright': '#1B2436',
    'surface-light': '#1B2436',
    'surface-variant': '#1F2A3D',
    'on-surface-variant': '#E2E8F0',
    'on-background': '#E2E8F0',
    'on-surface': '#E2E8F0',
    primary: '#60A5FA',
    'on-primary': '#0B1220',
    'primary-darken-1': '#3B82F6',
    secondary: '#93C5FD',
    'on-secondary': '#0B1220',
    accent: '#34D399',
    'on-accent': '#0B1220',
    success: '#34D399',
    info: '#60A5FA',
    warning: '#FBBF24',
    error: '#F87171',
    'status-neutral': '#94A3B8',
    'status-success': '#34D399',
    'status-warning': '#FBBF24',
    'status-error': '#F87171'
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const vuetify = createVuetify({
    ssr: true,
    components,
    directives,
    locale: { locale: 'es', messages: { es } },
    defaults: {
      VBtn: { rounded: 'lg', style: 'text-transform: none; letter-spacing: 0;' },
      VCard: { rounded: 'lg' },
      VSheet: { rounded: 'lg' },
      VTextField: { variant: 'outlined', density: 'comfortable' },
      VSelect: { variant: 'outlined', density: 'comfortable' },
      VTextarea: { variant: 'outlined', density: 'comfortable' },
      VAutocomplete: { variant: 'outlined', density: 'comfortable' },
      VCombobox: { variant: 'outlined', density: 'comfortable' },
      VDataTable: { density: 'comfortable' }
    },
    theme: {
      defaultTheme: 'mbpLight',
      themes: { mbpLight, mbpDark }
    }
  })
  nuxtApp.vueApp.use(vuetify)
})
