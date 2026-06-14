// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  app: {
    head: {
      title: 'MBP Testing — QA & Security Engineering',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#1E3A8A' }
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap'
        }
      ]
    }
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api'
    }
  },
  nitro: {
    routeRules: {
      '/api/**': { proxy: process.env.NUXT_API_PROXY_TARGET || 'http://localhost:8080/api/**' }
    }
  },
  routeRules: {
    '/login': { ssr: false },
    '/estoy-dentro': { ssr: false },
    '/solicitar': { ssr: false }
  },
  vite: {
    vue: {
      template: { transformAssetUrls: { base: null, includeAbsolute: false } }
    },
    server: {
      hmr: { clientPort: Number(process.env.FRONTEND_PORT) || 3000 }
    }
  },
  css: [
    '@mdi/font/css/materialdesignicons.css',
    '~/assets/css/app.css'
  ],
  modules: ['@pinia/nuxt', '@nuxtjs/i18n'],
  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'es',
    locales: [
      { code: 'es', name: 'Español', file: 'es.json' },
      { code: 'en', name: 'English', file: 'en.json' }
    ]
  },
  build: { transpile: ['vuetify'] },
  devtools: { enabled: true },
  compatibilityDate: '2025-07-15'
})
