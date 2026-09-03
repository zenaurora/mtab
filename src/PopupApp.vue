<script setup lang="ts">
import OpenTabsPicker from './components/OpenTabsPicker.vue'

function closeAfterFeedback() {
  window.setTimeout(() => window.close(), 1050)
}
</script>

<template>
  <OpenTabsPicker surface="popup" @saved="closeAfterFeedback" />
</template>
