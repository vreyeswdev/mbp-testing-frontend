<script setup lang="ts">
const props = defineProps<{
  status: string | null | undefined
  label?: string
  size?: 'x-small' | 'small' | 'default' | 'large'
  variant?: 'flat' | 'tonal' | 'outlined' | 'text'
}>()

const { get } = useStatusToken()
const token = computed(() => get(props.status))
</script>

<template>
  <v-chip
    :color="token.color"
    :prepend-icon="token.icon"
    :size="size ?? 'small'"
    :variant="variant ?? 'tonal'"
    class="font-weight-medium text-uppercase status-chip"
  >
    {{ label ?? status ?? '—' }}
  </v-chip>
</template>

<style scoped>
.status-chip {
  letter-spacing: 0.04em;
}
</style>
