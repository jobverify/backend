export const getWorkdayShardKey = (url) => {
  const parsed = new URL(url)
  return parsed.hostname.match(/(?:^|\.)(wd\d+)\.myworkday(?:jobs|site)\.com$/i)?.[1]?.toLowerCase()
    || parsed.origin
}

// All tenants in this process share shard capacity and server cooldowns.
// Listing requests take priority over optional detail enrichment.
export class WorkdayRequestScheduler {
  constructor({ minIntervalMs = 250, maxConcurrent = 4, now = () => Date.now() } = {}) {
    this.minIntervalMs = Math.max(0, Number(minIntervalMs) || 0)
    this.maxConcurrent = Math.max(1, Number.parseInt(maxConcurrent, 10) || 1)
    this.now = now
    this.shards = new Map()
  }

  stateFor(url) {
    const key = getWorkdayShardKey(url)
    if (!this.shards.has(key)) {
      this.shards.set(key, { active: 0, queue: [], nextStartAt: 0, cooldownUntil: 0, timer: null })
    }
    return this.shards.get(key)
  }

  acquire(url, { signal = null, kind = 'listing' } = {}) {
    if (signal?.aborted) return Promise.reject(signal.reason)
    const state = this.stateFor(url)
    return new Promise((resolve, reject) => {
      const entry = { resolve, signal, kind, onAbort: null }
      entry.onAbort = () => {
        const index = state.queue.indexOf(entry)
        if (index >= 0) state.queue.splice(index, 1)
        signal.removeEventListener('abort', entry.onAbort)
        reject(signal.reason)
        this.drain(state)
      }
      signal?.addEventListener('abort', entry.onAbort, { once: true })
      state.queue.push(entry)
      this.drain(state)
    })
  }

  recordRateLimit(url, delayMs) {
    const state = this.stateFor(url)
    state.cooldownUntil = Math.max(state.cooldownUntil, this.now() + Math.max(0, delayMs))
    this.drain(state)
  }

  drain(state) {
    clearTimeout(state.timer)
    state.timer = null
    if (!state.queue.length || state.active >= this.maxConcurrent) return
    const waitMs = Math.max(state.nextStartAt, state.cooldownUntil) - this.now()
    if (waitMs > 0) {
      state.timer = setTimeout(() => this.drain(state), Math.min(waitMs, 2 ** 31 - 1))
      return
    }
    const listingIndex = state.queue.findIndex((entry) => entry.kind === 'listing')
    const [entry] = state.queue.splice(listingIndex < 0 ? 0 : listingIndex, 1)
    entry.signal?.removeEventListener('abort', entry.onAbort)
    state.active += 1
    state.nextStartAt = this.now() + this.minIntervalMs
    let released = false
    entry.resolve(() => {
      if (released) return
      released = true
      state.active -= 1
      this.drain(state)
    })
    this.drain(state)
  }
}

export const workdayRequestScheduler = new WorkdayRequestScheduler()
