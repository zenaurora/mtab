import { useSettingsStore } from '../stores/settings'

/** Wait for settings and notes before leaving the extension page. */
export async function navigateAfterSavingSettings(url: string): Promise<void> {
  try {
    await useSettingsStore().save()
    window.location.href = url
  } catch (error) {
    console.warn('[navigation] Settings could not be saved:', error)
  }
}
