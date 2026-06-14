import { defineStore } from 'pinia'

export type Role = 'ROLE_CLIENTE' | 'ROLE_ESPECIALISTA' | 'ROLE_ADMIN'

export interface AuthUser {
  id: string | null
  email: string | null
  fullName: string | null
  roles: Role[]
  roleLabels: string[]
}

export interface AuthState extends AuthUser {
  accessToken: string | null
}

export interface AuthSessionPayload {
  accessToken: string
  user: {
    id: string
    email: string
    fullName: string
    roles: Role[]
    roleLabels?: string[]
  }
}

export const META_COOKIE = 'mbp_auth'
export const TOKEN_COOKIE = 'mbp_token'
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

export function authMetaCookie() {
  return useCookie<AuthUser | null>(META_COOKIE, {
    default: () => null,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    secure: !import.meta.dev
  })
}

export function authTokenCookie() {
  return useCookie<string | null>(TOKEN_COOKIE, {
    default: () => null,
    sameSite: 'lax',
    maxAge: AUTH_COOKIE_MAX_AGE,
    secure: !import.meta.dev
  })
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    id: null,
    email: null,
    fullName: null,
    roles: [],
    roleLabels: [],
    accessToken: null
  }),
  getters: {
    isAuthenticated: (s) => !!s.accessToken,
    bearerHeader: (s) => (s.accessToken ? `Bearer ${s.accessToken}` : null),
    isAdmin: (s) => s.roles.includes('ROLE_ADMIN'),
    isEspecialista: (s) => s.roles.includes('ROLE_ESPECIALISTA'),
    isCliente: (s) => s.roles.includes('ROLE_CLIENTE'),
    hasRole: (s) => (role: Role) => s.roles.includes(role)
  },
  actions: {
    setSession(payload: AuthSessionPayload) {
      this.id = payload.user.id
      this.email = payload.user.email
      this.fullName = payload.user.fullName
      this.roles = [...(payload.user.roles ?? [])]
      this.roleLabels = [...(payload.user.roleLabels ?? [])]
      this.accessToken = payload.accessToken
      authMetaCookie().value = {
        id: payload.user.id,
        email: payload.user.email,
        fullName: payload.user.fullName,
        roles: this.roles,
        roleLabels: this.roleLabels
      }
      authTokenCookie().value = payload.accessToken
    },
    applyFromCookies(meta: AuthUser | null, token: string | null) {
      this.id = meta?.id ?? null
      this.email = meta?.email ?? null
      this.fullName = meta?.fullName ?? null
      this.roles = Array.isArray(meta?.roles) ? [...meta.roles] : []
      this.roleLabels = Array.isArray(meta?.roleLabels) ? [...meta.roleLabels] : []
      this.accessToken = token ?? null
    },
    loadFromStorage() {
      this.applyFromCookies(authMetaCookie().value, authTokenCookie().value)
    },
    clearLocal() {
      this.id = null
      this.email = null
      this.fullName = null
      this.roles = []
      this.roleLabels = []
      this.accessToken = null
      authMetaCookie().value = null
      authTokenCookie().value = null
    },
    logout() {
      this.clearLocal()
      navigateTo('/login')
    }
  }
})
