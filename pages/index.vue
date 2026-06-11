<script setup lang="ts">
definePageMeta({ middleware: [] })

onMounted(() => {
  navigateTo('/bienvenida', { replace: true })
})
</script>

<template>
  <v-container class="d-flex justify-center align-center" style="min-height: 60vh">
    <v-progress-circular indeterminate color="primary" />
  </v-container>
</template>
