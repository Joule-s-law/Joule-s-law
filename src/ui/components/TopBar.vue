<template>
  <header class="top-bar">
    <div class="brand">焦耳定律</div>
    <div class="stats">
      <span class="money">{{ sandbox ? '¥ ∞' : `¥ ${money.toFixed(2)}` }}</span>
      <span class="income">{{ sandbox ? '+∞/s' : incomePerSecond >= 0.01 ? '+' + incomePerSecond.toFixed(2) + '/s' : '+0.00/s' }}</span>
    </div>
    <div class="tip">点击电路板空白处产热</div>
    <button class="toggle-btn" :class="{ active: sandbox }" @click="toggleSandbox">沙盒模式</button>
    <button class="toggle-btn" :class="{ active: fieldMode }" @click="toggleFieldMode">电场模式</button>
    <button class="save-btn" :disabled="sandbox" @click="game.manualSave()">保存</button>
    <button class="clear-btn" @click="clearAll">清除数据</button>
    <button class="tech-btn" @click="game.openTechTree()">产线优化</button>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/useGameStore'
import { useSettingsStore } from '../settings/useSettingsStore'

const game = useGameStore()
const settings = useSettingsStore()
const money = computed(() => game.money)
const incomePerSecond = computed(() => game.incomePerSecond)
const sandbox = computed(() => settings.sandboxMode)
const fieldMode = computed(() => settings.electricFieldMode)

function toggleSandbox(): void {
  if (!settings.sandboxMode) game.manualSave()
  settings.sandboxMode = !settings.sandboxMode
  settings.freePurchases = settings.sandboxMode
  if (settings.sandboxMode) game.debugUnlockAllTech()
}

function toggleFieldMode(): void {
  settings.electricFieldMode = !settings.electricFieldMode
}

function clearAll(): void {
  if (!window.confirm('确定清除所有本地数据吗？金钱、科技、元件布局与设置将全部重置。')) return
  localStorage.clear()
  location.reload()
}
</script>

<style scoped>
.top-bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 20px;
  background: #1b2230;
  border-bottom: 1px solid #2c3648;
}
.brand {
  font-weight: 700;
  font-size: 18px;
  color: #4fc3f7;
}
.stats {
  display: flex;
  gap: 16px;
}
.money {
  font-size: 18px;
  font-weight: 700;
  color: #ffd54f;
}
.income {
  color: #81c784;
  font-size: 15px;
}
.tip {
  margin-left: auto;
  color: #78909c;
  font-size: 12px;
}
.tech-btn {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  background: #2c6e9e;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.tech-btn:hover {
  background: #3a86c0;
}
.save-btn {
  padding: 8px 14px;
  background: #2c3648;
  color: #cfd8dc;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.save-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.toggle-btn {
  padding: 8px 14px;
  background: #2c3648;
  color: #cfd8dc;
  border: 1px solid #3a4658;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}
.toggle-btn:hover {
  background: #37455c;
}
.toggle-btn.active {
  background: #1e8e4e;
  color: #e8f5e9;
  border-color: #2ab563;
}
.clear-btn {
  padding: 8px 14px;
  background: #6e2c2c;
  color: #ef9a9a;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
