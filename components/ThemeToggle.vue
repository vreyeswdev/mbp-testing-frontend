<script setup lang="ts">
const { isDark, toggle } = useAppTheme()
</script>

<template>
  <v-btn
    :icon="isDark ? 'mdi-weather-night' : 'mdi-white-balance-sunny'"
    variant="text"
    density="comfortable"
    @click="toggle"
    :aria-label="isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
  />
</template>
