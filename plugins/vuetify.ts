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
      VBtn: { rounded: 'lg', style: 'text-transform: none; letter-spacing: 0;' },
      VCard: { rounded: 'lg' },
      VTextField: { variant: 'outlined', density: 'comfortable' },
      VSelect: { variant: 'outlined', density: 'comfortable' },
      VTextarea: { variant: 'outlined', density: 'comfortable' }
    },
    theme: {
      defaultTheme: 'light',
      themes: {
        light: {
          dark: false,
          colors: {
            primary: '#1976D2',
            secondary: '#424242',
            accent: '#82B1FF',
            background: '#FAFAFA',
            surface: '#FFFFFF',
            success: '#4CAF50',
            info: '#2196F3',
            warning: '#FB8C00',
            error: '#FF5252'
          }
        }
      }
    }
  })
  nuxtApp.vueApp.use(vuetify)
})
