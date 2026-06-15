import { useTheme } from 'vuetify'

const COOKIE = 'mbp_theme'

export function useAppTheme() {
  const theme = useTheme()
  const cookie = useCookie<'light' | 'dark'>(COOKIE, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax'
  })

  const isDark = computed(() => theme.global.current.value.dark)

  function apply(value: 'light' | 'dark') {
    theme.global.name.value = value === 'dark' ? 'mbpDark' : 'mbpLight'
    cookie.value = value
  }

  function toggle() {
    apply(isDark.value ? 'light' : 'dark')
  }

  onMounted(() => {
    if (cookie.value === 'dark' || cookie.value === 'light') apply(cookie.value)
  })

  return { isDark, apply, toggle }
}
