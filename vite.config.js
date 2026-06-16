import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 使用相对路径，兼容 GitHub Pages 子路径部署
  base: './',
  build: {
    outDir: 'dist',
  },
})
