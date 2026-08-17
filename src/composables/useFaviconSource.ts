import { computed, ref, watch, type ComputedRef } from 'vue'
import type { Bookmark } from '../types'
import { faviconCandidates } from '../utils/bookmarkIcon'
import { shouldRejectLoadedFavicon } from '../utils/faviconValidation'

type FaviconBookmark = Pick<Bookmark, 'url' | 'iconUrl'>

export function useFaviconSource(getBookmark: () => FaviconBookmark): {
  iconSrc: ComputedRef<string>
  advanceOrFail: () => void
  acceptLoadedImage: (image: HTMLImageElement) => void
} {
  const candidateIndex = ref(0)
  const exhausted = ref(false)
  const candidates = computed(() => faviconCandidates(getBookmark()))
  const iconSrc = computed(() => exhausted.value ? '' : candidates.value[candidateIndex.value] ?? '')

  watch(
    () => [getBookmark().url, getBookmark().iconUrl],
    () => {
      candidateIndex.value = 0
      exhausted.value = false
    },
    { immediate: true },
  )

  function advanceOrFail() {
    if (candidateIndex.value < candidates.value.length - 1) {
      candidateIndex.value += 1
      return
    }
    exhausted.value = true
  }

  function acceptLoadedImage(image: HTMLImageElement) {
    if (shouldRejectLoadedFavicon(image)) advanceOrFail()
  }

  return { iconSrc, advanceOrFail, acceptLoadedImage }
}
