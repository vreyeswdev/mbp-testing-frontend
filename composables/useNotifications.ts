import { useApi } from '~/composables/useApi'

export interface NotificationDto {
  id: string
  type: string
  message: string
  refType: string | null
  refId: string | null
  readAt: string | null
  createdAt: string
}

let pollHandle: ReturnType<typeof setInterval> | null = null

export const useNotifications = () => {
  const api = useApi()
  const list = useState<NotificationDto[]>('notif-list', () => [])
  const unread = useState<number>('notif-unread', () => 0)

  async function refresh() {
    try {
      const [items, c] = await Promise.all([
        api.get<NotificationDto[]>('/notifications'),
        api.get<{ count: number }>('/notifications/unread-count')
      ])
      list.value = items
      unread.value = c.count
    } catch {
      // silencioso
    }
  }

  async function markRead(id: string) {
    await api.post(`/notifications/${id}/read`, {})
    await refresh()
  }

  async function markAllRead() {
    await api.post('/notifications/mark-all-read', {})
    await refresh()
  }

  function startPolling(intervalMs = 60000) {
    if (pollHandle) return
    refresh()
    pollHandle = setInterval(refresh, intervalMs)
  }

  function stopPolling() {
    if (pollHandle) {
      clearInterval(pollHandle)
      pollHandle = null
    }
  }

  return { list, unread, refresh, markRead, markAllRead, startPolling, stopPolling }
}
