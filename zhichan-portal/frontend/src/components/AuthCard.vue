<script setup lang="ts">
import BrandLogo from '@/components/BrandLogo.vue'

defineProps<{
  title: string
  subtitle: string
  color: string
  soft: string
  shadow: string
}>()
</script>

<template>
  <div
    class="auth-page"
    :style="{
      '--accent': color,
      '--accent-soft': soft,
      '--accent-shadow': shadow,
    }"
  >
    <div class="auth-card">
      <BrandLogo :size="56" />
      <h1>{{ title }}</h1>
      <p class="auth-subtitle">{{ subtitle }}</p>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8f4fd;
  padding: 24px;
}

.auth-card {
  width: min(430px, 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #ffffff;
  border-radius: 16px;
  border-top: 6px solid var(--accent);
  padding: 44px 36px 36px;
  box-shadow: 0 12px 40px var(--accent-shadow);
}

.auth-card h1 {
  margin: 12px 0 0;
  font-size: 26px;
  color: var(--accent);
}

.auth-subtitle {
  margin: 6px 0 0;
  font-size: 14px;
  color: #6b7280;
}
</style>
