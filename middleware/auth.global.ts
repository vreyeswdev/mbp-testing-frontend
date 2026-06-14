import { useAuthStore, authMetaCookie, authTokenCookie } from '~/stores/auth'
import type { Role } from '~/stores/auth'

const PUBLIC_PATHS = ['/login', '/bienvenida', '/solicitar']

function isPublic(path: string): boolean {
  if (path === '/') return true
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))
}

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  // Leemos las cookies en el contexto del middleware (válido en SSR y cliente)
  // y aplicamos al store, en vez de llamar useCookie dentro de la acción Pinia.
  auth.applyFromCookies(authMetaCookie().value, authTokenCookie().value)

  if (isPublic(to.path)) return
  if (!auth.isAuthenticated) return navigateTo('/login')

  const required = to.meta?.requiresRole as Role | Role[] | undefined
  if (!required) return
  const requiredList = Array.isArray(required) ? required : [required]
  const ok = requiredList.some(r => auth.roles.includes(r))
  if (!ok) return navigateTo('/')
})
