function cloneValue<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasIds(value: unknown[]): value is Array<Record<string, unknown> & { id: string }> {
  const ids = new Set<string>()
  return value.every((entry) => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || ids.has(entry.id)) return false
    ids.add(entry.id)
    return true
  })
}

function mergeItems(
  before: Array<Record<string, unknown> & { id: string }>,
  after: Array<Record<string, unknown> & { id: string }>,
  latest: Array<Record<string, unknown> & { id: string }>,
): Array<Record<string, unknown> & { id: string }> {
  const beforeById = new Map(before.map((item) => [item.id, item]))
  const afterIds = new Set(after.map((item) => item.id))
  const merged = latest
    .filter((item) => !beforeById.has(item.id) || afterIds.has(item.id))
    .map((item) => cloneValue(item))

  for (const item of after) {
    const index = merged.findIndex((entry) => entry.id === item.id)
    if (index !== -1) {
      if (beforeById.has(item.id)) {
        merged[index] = mergeChanges(beforeById.get(item.id), item, merged[index]) as typeof item
      }
      continue
    }

    // An unchanged local entry must not undo another tab's deletion.
    const previous = beforeById.get(item.id)
    if (previous && sameValue(previous, item)) continue

    const following = after.slice(after.findIndex((entry) => entry.id === item.id) + 1)
      .find((entry) => merged.some((current) => current.id === entry.id))
    if (following) {
      merged.splice(merged.findIndex((entry) => entry.id === following.id), 0, cloneValue(item))
    } else {
      merged.push(cloneValue(item))
    }
  }
  return merged
}

/** Apply only the changes between before and after to a newer stored value. */
export function mergeChanges<T>(before: T, after: T, latest: T): T {
  if (sameValue(before, after)) return cloneValue(latest)

  if (
    Array.isArray(before) && Array.isArray(after) && Array.isArray(latest) &&
    hasIds(before) && hasIds(after) && hasIds(latest)
  ) {
    return mergeItems(before, after, latest) as T
  }

  if (isRecord(before) && isRecord(after) && isRecord(latest)) {
    const result: Record<string, unknown> = cloneValue(latest)
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (sameValue(before[key], after[key])) continue
      if (!(key in after)) delete result[key]
      else result[key] = mergeChanges(before[key], after[key], latest[key])
    }
    return result as T
  }

  return cloneValue(after)
}
