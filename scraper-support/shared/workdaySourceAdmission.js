import path from 'node:path'

import { isWorkdayBackedProvider } from '../providers/sourcePaths.js'
import { loadConfig } from '../utils/loadConfig.js'
import { inferWorkdayJobsApiConfig } from '../myworkday/engine.js'
import { getWorkdayShardKey } from '../myworkday/requestScheduler.js'

export const DEFAULT_WORKDAY_SOURCE_ADMISSION_TIMEOUT_MS = 30 * 60 * 1000
const groups = new Map()

const admissionGroup = scraper => {
  const provider = scraper?.provider
  if (!isWorkdayBackedProvider(provider)) return null
  const directory = provider.sourceDirectory || (provider.modulePath && path.dirname(provider.modulePath))
  if (typeof directory !== 'string' || !path.isAbsolute(directory)) return null
  const config = loadConfig(directory)
  // This finite paired native India reader still shares wd115's admission
  // queue. Admission controls traffic; it does not certify company coverage.
  const pairedCondeIndia = provider.source === 'condenast'
    && config.inventoryScope === 'published-india-country-facet-with-paired-native-roles'
    && config.officialCareersUrl === 'https://www.condenast.com/careers'
    && config.jobsApiUrl === 'https://condenast.wd115.myworkdayjobs.com/wday/cxs/condenast/CondeCareers/jobs'
    && config.detailUrlBase === 'https://condenast.wd115.myworkdayjobs.com/CondeCareers'
    && config.locationCountry === 'c4f78be1a8f14da0ab49ce1162348a5e'
    && config.searchText === ''
  if (config.listingStrategy !== 'jobs-api'
    || config.inventoryScope !== 'complete-board-country-proof' && !pairedCondeIndia) return null
  try {
    const official = new URL(config.officialCareersUrl), api = new URL(config.jobsApiUrl)
    if (official.protocol !== 'https:' || official.username || official.password || official.hash
      || api.protocol !== 'https:' || api.username || api.password || api.search || api.hash
      || !/\.myworkday(?:jobs|site)\.com$/i.test(api.hostname)
      || inferWorkdayJobsApiConfig(config.detailUrlBase)?.jobsApiUrl !== api.href) return null
    return 'workday:' + getWorkdayShardKey(api.href)
  } catch { return null }
}

const drain = (key, group) => {
  if (group.active) return
  const next = group.waiters.shift()
  if (!next) { groups.delete(key); return }
  group.active = next
  next.admit()
}

// Acquire before starting the per-attempt source timer. The caller must pass
// lease.signal to the native operation and release in finally. The lifecycle
// signal and the finite admission+lease ceiling both abort that same signal.
// Cancellation of an admitted operation does not mean it has settled: retain
// exclusivity until the caller finishes its bounded abort settlement and releases.
export async function acquireWorkdaySourceAdmission(scraper, {
  signal = null, onWait = null,
  admissionTimeoutMs = DEFAULT_WORKDAY_SOURCE_ADMISSION_TIMEOUT_MS,
} = {}) {
  const groupKey = admissionGroup(scraper)
  if (!groupKey) return null
  if (!Number.isInteger(admissionTimeoutMs) || admissionTimeoutMs <= 0
    || admissionTimeoutMs > DEFAULT_WORKDAY_SOURCE_ADMISSION_TIMEOUT_MS) throw new RangeError('Invalid Workday source admission deadline')
  if (onWait != null && typeof onWait !== 'function') throw new TypeError('Workday admission onWait must be a function')
  signal?.throwIfAborted()
  const queuedAt = Date.now(), controller = new AbortController()
  if (!groups.has(groupKey)) groups.set(groupKey, { active: null, waiters: [] })
  const group = groups.get(groupKey)

  return new Promise((resolve, reject) => {
    let released = false, admitted = false, timer
    const forwardAbort = () => controller.abort(signal.reason)
    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', forwardAbort)
      controller.signal.removeEventListener('abort', abort)
    }
    const release = () => {
      if (released) return
      released = true
      cleanup()
      if (group.active === entry) group.active = null
      else {
        const index = group.waiters.indexOf(entry)
        if (index >= 0) group.waiters.splice(index, 1)
      }
      drain(groupKey, group)
    }
    const abort = () => {
      if (admitted) { cleanup(); return }
      reject(controller.signal.reason)
      release()
    }
    const entry = { admit() {
      admitted = true
      resolve({ release, queueWaitMs: Math.max(0, Date.now() - queuedAt), groupKey, signal: controller.signal })
    } }
    group.waiters.push(entry)
    controller.signal.addEventListener('abort', abort, { once: true })
    signal?.addEventListener('abort', forwardAbort, { once: true })
    timer = setTimeout(() => controller.abort(Object.assign(
      new Error('Workday source admission deadline exceeded after ' + admissionTimeoutMs + 'ms for ' + groupKey),
      { name: 'WorkdaySourceAdmissionTimeoutError', code: 'WORKDAY_SOURCE_ADMISSION_TIMEOUT',
        groupKey, admissionTimeoutMs, queueWaitMs: Math.max(0, Date.now() - queuedAt),
        phase: admitted ? 'operation' : 'queue', abortRetries: true },
    )), admissionTimeoutMs)
    timer.unref?.()
    if (group.active && onWait) {
      try { onWait({ groupKey, queuePosition: group.waiters.length, queueWaitMs: 0, source: scraper.name || scraper.provider.source }) }
      catch (error) { controller.abort(error); return }
    }
    if (signal?.aborted) { forwardAbort(); return }
    drain(groupKey, group)
  })
}
