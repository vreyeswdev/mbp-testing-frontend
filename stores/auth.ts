import { defineStore } from 'pinia'

export type Role = 'ROLE_USER'

export interface AuthUser {
  id: string | null
  email: string | null
  fullName: string | null
  role: Role | null
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
    role: Role
  }
}

const META_COOKIE = 'mbp_auth'
const TOKEN_COOKIE = 'mbp_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function metaCookie() {
  return useCookie<AuthUser>(META_COOKIE, {
    default: () => ({ id: null, email: null, fullName: null, role: null }),
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    secure: !import.meta.dev
  })
}

function tokenCookie() {
  return useCookie<string | null>(TOKEN_COOKIE, {
    default: () => null,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    secure: !import.meta.dev
  })
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    id: null,
    email: null,
    fullName: null,
    role: null,
    accessToken: null
  }),
  getters: {
    isAuthenticated: (s) => !!s.accessToken,
    bearerHeader: (s) => (s.accessToken ? `Bearer ${s.accessToken}` : null)
  },
  actions: {
    setSession(payload: AuthSessionPayload) {
      this.id = payload.user.id
      this.email = payload.user.email
      this.fullName = payload.user.fullName
      this.role = payload.user.role
      this.accessToken = payload.accessToken
      metaCookie().value = {
        id: payload.user.id,
        email: payload.user.email,
        fullName: payload.user.fullName,
        role: payload.user.role
      }
      tokenCookie().value = payload.accessToken
    },
    loadFromStorage() {
      const meta = metaCookie().value
      const token = tokenCookie().value
      this.id = meta?.id ?? null
      this.email = meta?.email ?? null
      this.fullName = meta?.fullName ?? null
      this.role = meta?.role ?? null
      this.accessToken = token ?? null
    },
    clearLocal() {
      this.id = null
      this.email = null
      this.fullName = null
      this.role = null
      this.accessToken = null
      metaCookie().value = { id: null, email: null, fullName: null, role: null }
      tokenCookie().value = null
    },
    logout() {
      this.clearLocal()
      navigateTo('/login')
    }
  }
})
