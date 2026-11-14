<template>
  <section class="info">
    <h2>元件信息</h2>
    <template v-if="info !== null">
      <div class="title-row">
        <div class="title">{{ info.displayName }}</div>
        <div v-if="info.labels.length" class="chips">
          <span v-for="label in info.labels" :key="label" class="chip">{{ label }}</span>
        </div>
      </div>
      <p class="desc">{{ info.description }}</p>
      <div class="row"><span>电流</span><span :class="{ danger: currentRatio > 1 }">{{ formatCurrent(info.current) }}</span></div>
      <div class="row"><span>电压</span><span>{{ info.voltage >= 0 ? '' : '-' }}{{ formatVoltage(info.voltage) }}</span></div>
      <div class="row"><span>当前电阻</span><span>{{ formatResistance(info.resistance) }}</span></div>
      <div class="row"><span>额定电流</span><span>{{ formatCurrent(info.ratedCurrent) }}</span></div>
      <div v-if="info.rotatable" class="row"><span>转速</span><span>{{ formatAngularValue(info.rotationSpeed, s.angularUnit) }}</span></div>
      <div v-if="info.isMagneticSensor" class="row"><span>磁感应强度</span><span>{{ formatWithPrefix(info.sensedFluxDensity * 1e-3, s.prefixFluxDensity, 'T') }}</span></div>
      <div v-if="info.isMagneticSensor" class="row"><span>磁通量</span><span>{{ formatWithPrefix(info.sensedFlux * 1e-3, s.prefixFlux, 'Wb') }}</span></div>
      <div class="overload">
        <div class="bar" :style="{ width: (info.overloadRatio * 100).toFixed(0) + '%' }"></div>
      </div>
      <div class="row"><span>过载进度</span><span>{{ (info.overloadRatio * 100).toFixed(0) }}%</span></div>

      <div v-if="info.isWire" class="extra">
        <div class="row"><span>材料</span><span>{{ materialName(info.wireMaterialId) }}</span></div>
        <div class="material-btns">
          <button
            v-for="materialId in game.unlockedWireMaterials()"
            :key="materialId"
            :class="{ active: materialId === info.wireMaterialId }"
            @click="game.setWireMaterial(materialId)"
          >
            {{ materialName(materialId) }}
          </button>
        </div>
      </div>

      <div v-if="info.isSwitch" class="extra">
        <button class="action" @click="game.toggleSwitch()">
          {{ info.switchClosed ? '断开开关' : '闭合开关' }}
        </button>
      </div>

      <div v-if="info.isBattery" class="extra">
        <div class="row"><span>状态</span><span>{{ batteryState }}</span></div>
        <div class="row"><span>电量</span><span>{{ (info.stateOfCharge * 100).toFixed(1) }}%</span></div>
      </div>

      <div v-if="info.isMagneticSensor" class="extra">
        <div class="row"><span>磁感应强度</span><span>{{ info.sensedFluxDensity.toFixed(2) }} mT</span></div>
        <div class="row"><span>磁通量</span><span>{{ info.sensedFlux.toFixed(3) }} mWb</span></div>
      </div>

      <div v-if="info.isTransformer" class="extra">
        <div class="row"><span>输入电压</span><span>{{ info.inputVoltage.toFixed(2) }} V</span></div>
        <div class="row"><span>输入电流</span><span>{{ Math.abs(info.inputCurrent).toFixed(3) }} A</span></div>
      </div>

      <div v-if="info.isFourthGenerator" class="extra">
        <div class="row">
          <span>名称</span>
          <input
            class="name-input"
            v-model="fourthGenNameDraft"
            maxlength="24"
            @change="game.renameFourthGenerator(fourthGenNameDraft)"
          />
        </div>
        <div class="row"><span>外部总电动势</span><span :class="{ danger: info.externalEmf < 0 }">{{ info.externalEmf >= 0 ? '+' : '' }}{{ info.externalEmf.toFixed(2) }} V</span></div>
        <div class="row uuid-row"><span>uuid</span><span class="uuid">{{ info.fourthGenUuid }}</span></div>
      </div>

      <button class="action sell" @click="game.sellSelected()">出售（返还 50%）</button>
    </template>
    <p v-else class="empty">点击电路板上的元件查看详情。</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useGameStore } from '../stores/useGameStore'
import { WIRE_MATERIALS } from '../../core/components/registry/wireMaterials'
import { useSettingsStore, formatWithPrefix, formatAngularValue } from '../settings/useSettingsStore'

const game = useGameStore()
const s = useSettingsStore()
const info = computed(() => game.selectedInfo)
const fourthGenNameDraft = ref('')
watch(
  () => info.value?.fourthGenUuid,
  () => {
    fourthGenNameDraft.value = info.value?.fourthGenName ?? ''
  },
  { immediate: true },
)
const currentRatio = computed(() => {
  const data = info.value
  return data !== null ? Math.abs(data.current) / Math.max(0.001, data.ratedCurrent) : 0
})
const batteryState = computed(() => {
  const data = info.value
  if (data === null) return ''
  if (Math.abs(data.current) < 0.001) return '待机（未接通回路）'
  return data.current < 0 ? '充电中' : '放电中'
})

function formatResistance(resistance: number): string {
  if (resistance === Number.POSITIVE_INFINITY) return '∞（断开）'
  return formatWithPrefix(resistance, s.prefixResistance, 'Ω')
}

function formatCurrent(value: number): string {
  return formatWithPrefix(Math.abs(value), s.prefixCurrent, 'A')
}

function formatVoltage(value: number): string {
  return formatWithPrefix(Math.abs(value), s.prefixVoltage, 'V')
}

function materialName(id: string): string {
  return WIRE_MATERIALS.get(id)?.displayName ?? id
}
</script>

<style scoped>
.info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.title {
  font-size: 15px;
  font-weight: 600;
  color: #4fc3f7;
}
.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 8px;
  background: rgba(179, 136, 255, 0.16);
  border: 1px solid rgba(179, 136, 255, 0.45);
  color: #ce93d8;
  white-space: nowrap;
}
.desc {
  font-size: 12px;
  line-height: 1.6;
  color: #90a4ae;
  background: #1b2230;
  border: 1px solid #2c3648;
  border-radius: 6px;
  padding: 8px;
  margin: 0;
}
.row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #b0bec5;
}
.row .danger {
  color: #e74c3c;
  font-weight: 700;
}
.overload {
  height: 6px;
  background: #2c3648;
  border-radius: 3px;
  overflow: hidden;
}
.overload .bar {
  height: 100%;
  background: linear-gradient(90deg, #f1c40f, #e74c3c);
}
.extra {
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.material-btns {
  display: flex;
  gap: 6px;
}
.material-btns button,
.action {
  padding: 6px 10px;
  background: #2c3648;
  color: #cfd8dc;
  border: 1px solid #3a4658;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
}
.material-btns button.active {
  border-color: #ffd54f;
  color: #ffd54f;
}
.name-input {
  width: 140px;
  padding: 4px 8px;
  background: #1b2230;
  color: #ecf0f1;
  border: 1px solid #3a4658;
  border-radius: 6px;
  font-size: 12px;
}
.name-input:focus {
  outline: none;
  border-color: #b388ff;
}
.uuid-row .uuid {
  font-size: 10px;
  color: #78909c;
  word-break: break-all;
  max-width: 150px;
  text-align: right;
}
.action.sell {
  margin-top: 10px;
  border-color: #e74c3c;
  color: #e74c3c;
}
.empty {
  color: #78909c;
  font-size: 12px;
}
</style>
