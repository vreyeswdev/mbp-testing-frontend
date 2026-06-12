<script setup lang="ts">
interface Props {
  title: string
  value: string | number
  hint?: string
  color?: string
  icon?: string
}
withDefaults(defineProps<Props>(), {
  hint: '',
  color: 'primary',
  icon: 'mdi-chart-box'
})
</script>

<template>
  <v-card variant="tonal" :color="color" class="h-100">
    <v-card-text>
      <div class="d-flex align-center">
        <v-icon size="32" class="me-3">{{ icon }}</v-icon>
        <div>
          <div class="text-overline">{{ title }}</div>
          <div class="text-h4 font-weight-medium">{{ value }}</div>
          <div v-if="hint" class="text-caption text-medium-emphasis">{{ hint }}</div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>
