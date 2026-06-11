import { useAuthStore } from '~/stores/auth'

export const useApi = () => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  async function request<T>(path: string, options: any = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
    const bearer = auth.bearerHeader
    if (bearer) headers.Authorization = bearer

    try {
      return await $fetch<T>(`${config.public.apiBase}${path}`, {
        ...options,
        headers
      })
    } catch (err: any) {
      const isAuthPath = path.startsWith('/auth/login') || path.startsWith('/auth/register')
      if (err?.statusCode === 401 && !isAuthPath) {
        auth.clearLocal()
        if (import.meta.client) navigateTo('/login')
      }
      throw err
    }
  }

  return {
    get:   <T>(path: string) => request<T>(path, { method: 'GET' }),
    post:  <T>(path: string, body?: any) => request<T>(path, { method: 'POST', body }),
    put:   <T>(path: string, body?: any) => request<T>(path, { method: 'PUT', body }),
    patch: <T>(path: string, body?: any) => request<T>(path, { method: 'PATCH', body }),
    del:   <T>(path: string) => request<T>(path, { method: 'DELETE' })
  }
}
