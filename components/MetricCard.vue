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
  <v-card class="cyber-card h-100">
    <v-card-text>
      <div class="d-flex align-center">
        <v-icon size="32" :color="color" class="me-3">{{ icon }}</v-icon>
        <div>
          <div class="cyber-subtitle">{{ title }}</div>
          <div class="text-h4 cyber-mono mt-1">{{ value }}</div>
          <div v-if="hint" class="text-caption text-medium-emphasis">{{ hint }}</div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>
