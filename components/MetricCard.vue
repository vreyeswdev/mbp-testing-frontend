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
  icon: 'mdi-chart-box-outline'
})
</script>

<template>
  <v-card variant="outlined" class="h-100">
    <v-card-text>
      <div class="d-flex align-center">
        <v-avatar :color="color" variant="tonal" rounded="md" size="44" class="me-3">
          <v-icon size="24">{{ icon }}</v-icon>
        </v-avatar>
        <div>
          <div class="text-caption text-medium-emphasis">{{ title }}</div>
          <div class="text-h5 font-weight-bold">{{ value }}</div>
          <div v-if="hint" class="text-caption text-medium-emphasis">{{ hint }}</div>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>
