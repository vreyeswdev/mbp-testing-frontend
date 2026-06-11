import { useAuthStore } from '~/stores/auth'

const PUBLIC_PATHS = ['/login', '/bienvenida']

function isPublic(path: string): boolean {
  if (path === '/') return true
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))
}

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.loadFromStorage()

  if (isPublic(to.path)) return
  if (!auth.isAuthenticated) return navigateTo('/login')
})
