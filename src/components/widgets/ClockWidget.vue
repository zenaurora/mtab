<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const time = ref('')
const seconds = ref(0)
let timer: ReturnType<typeof setTimeout> | null = null

function update() {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  time.value = `${h}:${m}:${s}`
  seconds.value = now.getSeconds()
}

function scheduleNextTick() {
  if (timer) clearTimeout(timer)
  timer = null
  if (document.hidden) return

  // Align updates to the next wall-clock second instead of accumulating
  // setInterval drift while the new-tab page stays open.
  const delay = 1000 - (Date.now() % 1000) + 10
  timer = setTimeout(() => {
    update()
    scheduleNextTick()
  }, delay)
}

function onVisibilityChange() {
  if (document.hidden) {
    if (timer) clearTimeout(timer)
    timer = null
    return
  }
  update()
  scheduleNextTick()
}

onMounted(() => {
  update()
  scheduleNextTick()
  document.addEventListener('visibilitychange', onVisibilityChange)
})

onUnmounted(() => {
  if (timer) clearTimeout(timer)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <div class="clock-widget">
    <div class="time">{{ time }}</div>
    <div class="seconds-ring">
      <svg viewBox="0 0 36 36" class="ring">
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="var(--border)"
          stroke-width="1.5"
        />
        <circle
          cx="18"
          cy="18"
          r="15.5"
          fill="none"
          stroke="var(--accent)"
          stroke-width="1.5"
          :stroke-dasharray="`${(seconds / 60) * 97.4} 97.4`"
          stroke-linecap="round"
          transform="rotate(-90 18 18)"
        />
      </svg>
    </div>
  </div>
</template>

<style scoped>
.clock-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 6px;
  position: relative;
}

.time {
  font-size: 36px;
  font-weight: 200;
  letter-spacing: 2px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.seconds-ring {
  width: 40px;
  height: 40px;
  opacity: 0.6;
}

.ring circle:last-child {
  transition: stroke-dasharray 0.3s ease;
}
</style>
