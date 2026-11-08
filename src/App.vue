<template>
  <el-container>
    <el-header class="app-header">
      <div class="header-content">
        <el-icon :size="28" class="header-icon"><MagicStick /></el-icon>
        <h1>PMDND 招式查询</h1>
      </div>
    </el-header>
    <el-main>
      <el-tabs v-model="activeView" class="main-tabs">
        <el-tab-pane label="招式查询" name="moves" />
        <el-tab-pane label="宝可梦可学招式" name="pokemon" />
      </el-tabs>
      <KeepAlive>
        <MoveQuery v-if="activeView === 'moves'" />
        <PokemonQuery v-else />
      </KeepAlive>
    </el-main>
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import MoveQuery from './components/MoveQuery.vue'
import PokemonQuery from './components/PokemonQuery.vue'

const activeView = ref('moves')
</script>

<style>
/* 全局重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, 'Noto Sans SC', sans-serif;
  background: #f0f2f5;
  color: #303133;
  min-height: 100vh;
}

.app-header {
  background: linear-gradient(135deg, #409eff, #337ecc);
  color: #fff;
  padding: 0 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 60px;
}

.header-content h1 {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
}

.header-icon {
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2));
}

.el-main {
  padding: 20px 16px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.main-tabs { margin-bottom: 12px; }

@media (max-width: 600px) {
  .app-header { padding: 0 16px; }
  .el-main { padding: 12px 8px; }
}
</style>
