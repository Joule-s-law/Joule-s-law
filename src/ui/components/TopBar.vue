<template>
  <header class="top-bar">
    <div class="brand">焦耳定律</div>
    <div class="stats">
      <span class="money">¥ {{ money.toFixed(2) }}</span>
      <span class="income">{{ incomePerSecond >= 0.01 ? '+' + incomePerSecond.toFixed(2) + '/s' : '+0.00/s' }}</span>
    </div>
    <div class="tip">点击电路板空白处产热</div>
    <button class="save-btn" @click="game.manualSave()">保存</button>
    <button class="clear-btn" @click="clearAll">清除数据</button>
    <button class="tech-btn" @click="game.openTechTree()">产线优化</button>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/useGameStore'

const game = useGameStore()
const money = computed(() => game.money)
const incomePerSecond = computed(() => game.incomePerSecond)

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
.clear-btn {
  padding: 8px 14px;
  background: #6e2c2c;
  color: #ef9a9a;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
</style>
