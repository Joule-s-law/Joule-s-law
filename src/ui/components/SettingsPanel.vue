<template>
  <section class="settings">
    <h2 class="toggle" @click="open = !open">⚙ 设置 <span class="arrow">{{ open ? '▾' : '▸' }}</span></h2>
    <template v-if="open">
      <div class="group">
        <div class="label">第四面墙后端地址</div>
        <input class="url" v-model="s.wsUrl" spellcheck="false" @change="game.applyWsUrl(s.wsUrl)" />
      </div>
      <div class="row">
        <span>转速单位</span>
        <select v-model="s.angularUnit">
          <option v-for="unit in ANGULAR_UNITS" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
        </select>
      </div>
      <div v-for="quantity in QUANTITIES" :key="quantity.key" class="row">
        <span>{{ quantity.name }}</span>
        <select v-model="s[quantity.key]">
          <option v-for="prefix in PREFIX_IDS" :key="prefix" :value="prefix">{{ PREFIX_SYMBOLS[prefix] + quantity.unit }}</option>
        </select>
      </div>
      <label class="row checkbox-row">
        <span>显示磁感线</span>
        <input type="checkbox" v-model="s.showFieldLines" />
      </label>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useGameStore } from '../stores/useGameStore'
import {
  useSettingsStore,
  ANGULAR_UNITS,
  PREFIX_SYMBOLS,
  type MetricPrefix,
} from '../settings/useSettingsStore'

const game = useGameStore()
const s = useSettingsStore()
const open = ref(false)

const PREFIX_IDS: MetricPrefix[] = ['k', 'none', 'm', 'u', 'n']

const QUANTITIES: Array<{ key: 'prefixCurrent' | 'prefixVoltage' | 'prefixResistance' | 'prefixFlux' | 'prefixFluxDensity'; name: string; unit: string }> = [
  { key: 'prefixCurrent', name: '电流单位', unit: 'A' },
  { key: 'prefixVoltage', name: '电压单位', unit: 'V' },
  { key: 'prefixResistance', name: '电阻单位', unit: 'Ω' },
  { key: 'prefixFlux', name: '磁通量单位', unit: 'Wb' },
  { key: 'prefixFluxDensity', name: '磁感应强度单位', unit: 'T' },
]
</script>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toggle {
  cursor: pointer;
  user-select: none;
}
.arrow {
  font-size: 11px;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: 12px;
  color: #b0bec5;
}
.url {
  padding: 6px 8px;
  background: #1b2230;
  color: #ecf0f1;
  border: 1px solid #3a4658;
  border-radius: 6px;
  font-size: 12px;
}
.url:focus {
  outline: none;
  border-color: #4fc3f7;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #b0bec5;
}
.row select {
  background: #1b2230;
  color: #cfd8dc;
  border: 1px solid #3a4658;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
}
.checkbox-row input {
  accent-color: #4fc3f7;
}
</style>
