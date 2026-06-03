<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const dateStr = ref('')
const dayOfWeek = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function update() {
  const now = new Date()
  dayOfWeek.value = DAYS[now.getDay()]
  dateStr.value = `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`
}

onMounted(() => {
  update()
  timer = setInterval(update, 60000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="date-widget">
    <div class="day">{{ dayOfWeek }}</div>
    <div class="date">{{ dateStr }}</div>
  </div>
</template>

<style scoped>
.date-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 4px;
}

.day {
  font-size: 14px;
  color: var(--accent);
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.date {
  font-size: 18px;
  font-weight: 300;
  color: var(--text-primary);
}
</style>
