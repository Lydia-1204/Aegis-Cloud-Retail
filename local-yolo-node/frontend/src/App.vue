<script setup lang="ts">
import VideoCount from './components/VideoCount.vue'
</script>

<template>
  <main class="app-shell">
    <VideoCount />
  </main>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
  background: #f8f9fa;
  padding: 40px;
}

@media (max-width: 768px) {
  .app-shell {
    padding: 20px;
  }
}
</style>
