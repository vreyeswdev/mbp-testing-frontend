<script setup lang="ts">
import logo from '~/assets/icon2.jpg'

withDefaults(defineProps<{
  size?: number
  showText?: boolean
  textClass?: string
}>(), {
  size: 32,
  showText: true,
  textClass: 'text-h6 font-weight-bold'
})

const { t } = useI18n()
</script>

<template>
  <div class="d-inline-flex align-center ga-2">
    <img :src="logo" alt="MBP" :width="size" :height="size" class="brand-mark__img" />
    <span v-if="showText" :class="textClass">{{ t('common.appName') }}</span>
  </div>
</template>

<style scoped>
.brand-mark__img {
  border-radius: 8px;
  object-fit: cover;
  display: block;
  mix-blend-mode: multiply;
}
:deep(.v-theme--mbpDark) .brand-mark__img {
  mix-blend-mode: screen;
  filter: brightness(1.05);
}
</style>
