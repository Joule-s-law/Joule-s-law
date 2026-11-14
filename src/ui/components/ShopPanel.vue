<template>
  <section class="shop">
    <h2>元件商店</h2>
    <div
      v-for="item in items"
      :key="item.def.id"
      class="shop-item"
      :class="{ poor: game.money < item.price, dragging: game.dragPlace?.defId === item.def.id }"
      @mousedown.prevent="game.startShopDrag(item.def.id)"
    >
      <div class="name">{{ item.def.displayName }}</div>
      <div class="price">¥ {{ formatPrice(item.price) }}</div>
      <div class="meta" v-if="item.def.portCount > 0">R={{ item.def.resistance }} / I额={{ item.def.ratedCurrent }}A</div>
      <div class="meta" v-else>机械传动件（不接电）</div>
    </div>
    <p class="hint">按住商品拖到电路板上放下购买；点击两个端口自动铺设导线（每根 ¥1）；相邻元件接线柱贴合时直接导通。</p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '../stores/useGameStore'

const game = useGameStore()
const items = computed(() => {
  void game.unlockedComponentsVersion
  void game.money
  return game.shopItems().filter((item) => item.unlocked)
})

function formatPrice(price: number): string {
  return price >= 1000 ? price.toExponential(2) : price.toFixed(0)
}
</script>

<style scoped>
.shop {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.shop-item {
  padding: 8px 10px;
  background: #1b2230;
  border: 1px solid #2c3648;
  border-radius: 6px;
  cursor: grab;
  user-select: none;
}
.shop-item:hover {
  border-color: #4fc3f7;
}
.shop-item.dragging {
  border-color: #ffd54f;
  background: #2a3040;
  cursor: grabbing;
}
.shop-item.poor {
  opacity: 0.7;
}
.name {
  font-size: 13px;
  color: #ecf0f1;
}
.lock {
  color: #e74c3c;
  font-size: 11px;
}
.price {
  color: #ffd54f;
  font-size: 13px;
}
.meta {
  color: #78909c;
  font-size: 11px;
}
.hint {
  color: #78909c;
  font-size: 11px;
  line-height: 1.5;
}
</style>
