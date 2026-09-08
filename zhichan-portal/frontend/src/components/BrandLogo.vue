<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 48 })
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="知产桥商标图标"
  >
    <rect x="2" y="2" width="60" height="60" rx="16" fill="#1e40af" />
    <path
      d="M15 41 Q32 17 49 41"
      stroke="#FFFFFF"
      stroke-width="4.5"
      stroke-linecap="round"
      fill="none"
    />
    <path d="M15 41 H49" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" />
    <path
      d="M19 46.5 V50.5 M32 46.5 V50.5 M45 46.5 V50.5"
      stroke="#FFFFFF"
      stroke-width="3"
      stroke-linecap="round"
    />
    <text
      x="32"
      y="27"
      text-anchor="middle"
      font-size="16"
      font-weight="700"
      fill="#FFFFFF"
      font-family="'PingFang SC','Microsoft YaHei',sans-serif"
    >
      知
    </text>
  </svg>
</template>
