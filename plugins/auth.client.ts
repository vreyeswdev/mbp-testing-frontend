import { useAuthStore, authMetaCookie, authTokenCookie } from '~/stores/auth'

export default defineNuxtPlugin(() => {
  const auth = useAuthStore()
  auth.applyFromCookies(authMetaCookie().value, authTokenCookie().value)
})
