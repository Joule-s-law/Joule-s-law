<template>
  <div class="layout">
    <TopBar />
    <div class="offline" v-if="game.offlineGained > 0">
      离线收益：+¥ {{ game.offlineGained.toFixed(2) }}
      <button @click="game.offlineGained = 0">知道了</button>
    </div>
    <main class="main">
      <aside class="left">
        <ShopPanel />
      </aside>
      <BoardView class="center" />
      <aside class="right">
        <InfoPanel />
      </aside>
    </main>
    <TechTreeView v-if="game.techTreeOpen" />
  </div>
</template>

<script setup lang="ts">
import TopBar from './ui/components/TopBar.vue'
import ShopPanel from './ui/components/ShopPanel.vue'
import InfoPanel from './ui/components/InfoPanel.vue'
import BoardView from './ui/components/BoardView.vue'
import TechTreeView from './ui/components/TechTreeView.vue'
import { useGameStore } from './ui/stores/useGameStore'

const game = useGameStore()
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  background: #0e1219;
  color: #ecf0f1;
  font-family: system-ui, sans-serif;
}
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.offline {
  padding: 8px 20px;
  background: #263238;
  color: #ffd54f;
  font-size: 13px;
  display: flex;
  gap: 12px;
  align-items: center;
}
.offline button {
  background: none;
  border: 1px solid #ffd54f;
  color: #ffd54f;
  border-radius: 4px;
  cursor: pointer;
}
.main {
  display: flex;
  gap: 12px;
  padding: 12px;
  flex: 1;
  overflow: hidden;
}
.left {
  width: clamp(180px, 18vw, 230px);
  min-width: 150px;
  overflow-y: auto;
  flex-shrink: 0;
}
.center {
  flex: 1;
  min-width: 0;
}
.right {
  width: clamp(190px, 19vw, 240px);
  min-width: 160px;
  flex-shrink: 0;
  overflow-y: auto;
}
h2 {
  font-size: 14px;
  color: #90a4ae;
  margin-bottom: 4px;
}
</style>
