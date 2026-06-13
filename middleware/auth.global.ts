import { useAuthStore } from '~/stores/auth'
import type { Role } from '~/stores/auth'

const PUBLIC_PATHS = ['/login', '/bienvenida', '/solicitar']

function isPublic(path: string): boolean {
  if (path === '/') return true
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))
}

export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()
  if (import.meta.client) auth.loadFromStorage()

  if (isPublic(to.path)) return
  if (!auth.isAuthenticated) return navigateTo('/login')

  const required = to.meta?.requiresRole as Role | Role[] | undefined
  if (!required) return
  const requiredList = Array.isArray(required) ? required : [required]
  const ok = requiredList.some(r => auth.roles.includes(r))
  if (!ok) return navigateTo('/')
})
