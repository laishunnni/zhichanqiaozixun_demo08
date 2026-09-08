<script setup lang="ts">
import { useRouter } from 'vue-router'
import BrandLogo from '@/components/BrandLogo.vue'

interface PortalCard {
  key: 'user' | 'expert' | 'admin'
  icon: string
  title: string
  desc: string
  color: string
  soft: string
  shadow: string
  path: string
}

const router = useRouter()

const cards: PortalCard[] = [
  {
    key: 'user',
    icon: '👤',
    title: '用户端',
    desc: '提交侵权材料，获取专业咨询',
    color: '#1e40af',
    soft: 'rgba(30, 64, 175, 0.10)',
    shadow: 'rgba(30, 64, 175, 0.20)',
    path: '/user/login',
  },
  {
    key: 'expert',
    icon: '🧑‍⚖️',
    title: '咨询专员端',
    desc: '处理案件，提供解决方案',
    color: '#2563eb',
    soft: 'rgba(37, 99, 235, 0.10)',
    shadow: 'rgba(37, 99, 235, 0.22)',
    path: '/expert/login',
  },
  {
    key: 'admin',
    icon: '⚙️',
    title: '平台管理端',
    desc: '审核排班，质量监管',
    color: '#3b82f6',
    soft: 'rgba(59, 130, 246, 0.10)',
    shadow: 'rgba(59, 130, 246, 0.22)',
    path: '/admin/login',
  },
]

function goTo(path: string): void {
  router.push(path)
}
</script>

<template>
  <div class="portal-page">
    <div class="portal-watermark" aria-hidden="true">
      <BrandLogo :size="130" />
      <span class="watermark-text">知产桥</span>
    </div>

    <main class="portal-main">
      <header class="portal-header">
        <div class="brand">
          <BrandLogo :size="52" />
          <h1 class="brand-name">知产桥</h1>
        </div>
        <p class="slogan">一站式知识产权人工咨询服务平台</p>
      </header>

      <section class="portal-cards" aria-label="选择登录入口">
        <article
          v-for="card in cards"
          :key="card.key"
          class="portal-card"
          role="link"
          tabindex="0"
          :style="{
            '--card-color': card.color,
            '--card-soft': card.soft,
            '--card-shadow': card.shadow,
          }"
          @click="goTo(card.path)"
          @keydown.enter="goTo(card.path)"
        >
          <div class="card-icon" :style="{ background: card.soft, color: card.color }">
            {{ card.icon }}
          </div>
          <h2 class="card-title">{{ card.title }}</h2>
          <p class="card-desc">{{ card.desc }}</p>
          <button
            type="button"
            class="card-btn"
            :style="{ background: card.color }"
            @click.stop="goTo(card.path)"
          >
            进入登录 →
          </button>
        </article>
      </section>
    </main>

    <footer class="portal-footer">
      <p>© 2026 知产桥人工咨询平台 版权所有</p>
      <p>知微见著 桥起微澜 · 了解详情，请关注微信公众号：知产桥</p>
    </footer>
  </div>
</template>

<style scoped>
.portal-page {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #e8f4fd;
  overflow-x: hidden;
}

.portal-watermark {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  opacity: 0.1;
  pointer-events: none;
  user-select: none;
}

.watermark-text {
  font-size: 64px;
  font-weight: 800;
  color: #1e40af;
  letter-spacing: 10px;
}

.portal-main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 56px;
  width: 100%;
  padding: 64px 24px 56px;
}

.portal-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  text-align: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-name {
  margin: 0;
  font-size: 42px;
  font-weight: 800;
  color: #1e40af;
  letter-spacing: 8px;
}

.slogan {
  margin: 0;
  font-size: 18px;
  color: #5b6470;
  letter-spacing: 2px;
}

.portal-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 32px;
  width: 100%;
  max-width: 1080px;
}

.portal-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 46px 32px 38px;
  background: #ffffff;
  border-radius: 18px;
  border: 1px solid rgba(31, 35, 41, 0.06);
  box-shadow: 0 8px 24px rgba(31, 35, 41, 0.06);
  cursor: pointer;
  overflow: hidden;
  transition:
    transform 0.25s ease,
    box-shadow 0.25s ease,
    border-color 0.25s ease;
}

.portal-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  background: var(--card-color);
}

.portal-card:hover,
.portal-card:focus-visible {
  transform: translateY(-8px);
  border-color: transparent;
  box-shadow: 0 20px 44px var(--card-shadow);
}

.portal-card:focus-visible {
  outline: 3px solid var(--card-color);
  outline-offset: 2px;
}

.card-icon {
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34px;
  border-radius: 50%;
  background: var(--card-soft);
}

.card-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--card-color);
}

.card-desc {
  margin: 0 0 8px;
  font-size: 15px;
  line-height: 1.6;
  color: #6b7280;
}

.card-btn {
  width: 100%;
  max-width: 220px;
  padding: 12px 20px;
  border: none;
  border-radius: 999px;
  background: var(--card-color);
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  cursor: pointer;
  box-shadow: 0 6px 16px var(--card-shadow);
  transition:
    filter 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.card-btn:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: 0 10px 22px var(--card-shadow);
}

.portal-footer {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 18px 24px;
  background: rgba(255, 255, 255, 0.72);
  border-top: 1px solid rgba(30, 64, 175, 0.08);
  text-align: center;
  font-size: 13px;
  color: #5b6470;
}

.portal-footer p {
  margin: 0;
}

@media (max-width: 900px) {
  .portal-cards {
    gap: 20px;
  }
}

@media (max-width: 768px) {
  .portal-main {
    gap: 40px;
    padding: 40px 20px 32px;
  }

  .portal-cards {
    grid-template-columns: 1fr;
    max-width: 420px;
  }

  .brand-name {
    font-size: 32px;
    letter-spacing: 5px;
  }

  .slogan {
    font-size: 15px;
    letter-spacing: 1px;
  }

  .watermark-text {
    font-size: 44px;
    letter-spacing: 6px;
  }
}
</style>
