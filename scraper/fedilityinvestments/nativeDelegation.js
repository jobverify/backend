import { createHash } from 'node:crypto'

import { HOME, BOARD, FEED } from '../fidelity/nativeContract.js'
import { attachInventoryDelegationEvidence } from '../../scraper-support/utils/inventoryDelegationEvidence.js'

// Use the canonical collector's existing fetchPage seam. These are its same
// requests, headers, redirect mode and composed caller/source deadline.
const defaultFetchPage = async (url, { signal }) => {
  signal?.throwIfAborted()
  try {
    const response = await fetch(url, { signal, headers: {
      Accept: 'text/html,application/xml;q=0.9,*/*;q=0.8', 'User-Agent': 'Mozilla/5.0',
    }, redirect: 'follow' })
    signal?.throwIfAborted()
    const body = await response.text()
    signal?.throwIfAborted()
    return { status: response.status, url: response.url, body, capturedAt: new Date().toISOString() }
  } catch (error) {
    signal?.throwIfAborted()
    throw error
  }
}

const nativeClock = (value, completedAt) => {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{4}-\d\d-\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,9})?(Z|[+-]\d\d:\d\d)$/)
  const at = Date.parse(value)
  if (!match || !Number.isFinite(at) || at <= 0 || at > completedAt
    || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null
  const calendar = Date.parse(match[1] + 'T00:00:00Z')
  if (!Number.isFinite(calendar) || new Date(calendar).toISOString().slice(0, 10) !== match[1]) return null
  return at
}

export async function runWithFidelityDelegation(canonical, options = {}) {
  const observations = [], fetchPage = options.fetchPage || defaultFetchPage
  const jobs = await canonical.run({ ...options, fetchPage: async (url, request) => {
    request.signal?.throwIfAborted()
    try {
      const page = await fetchPage(url, request)
      request.signal?.throwIfAborted()
      // Hash exactly the plain body snapshot passed to the unchanged child
      // guards. Caller-provided hashes are never accepted as body evidence.
      const packet = { status: page?.status, url: page?.url, body: page?.body }
      const qualified = packet.status === 200 && packet.url === url
        && typeof packet.body === 'string' && packet.body.length <= 5000000
      observations.push({ url, finalUrl: packet.url, status: packet.status, qualified,
        sha256: qualified ? createHash('sha256').update(packet.body).digest('hex') : null,
        // A replay must provide its actual native clock explicitly. An
        // inherited/accessor/absent clock cannot inherit this invocation's time.
        capturedAt: Object.getOwnPropertyDescriptor(page ?? {}, 'capturedAt')?.value })
      return packet
    } catch (error) {
      request.signal?.throwIfAborted()
      throw error
    }
  } })
  options.signal?.throwIfAborted()

  // Success means HOME identity, board/feed/full-detail and closing guards all
  // passed. This observation certifies only the historical wrapper boundary.
  if (!Array.isArray(jobs) || jobs.some(job => job.source !== 'fidelity' || job.company !== 'Fidelity Investments')) return jobs
  const completedAt = Date.now(), clocks = observations.map(page => nativeClock(page.capturedAt, completedAt))
  const responses = observations.filter(page => [HOME, BOARD, FEED].includes(page.url))
  if (!observations.length || observations.some(page => !page.qualified) || clocks.some(at => at == null)
    || responses.length > 10 || ![HOME, BOARD, FEED].every(url => responses.some(page => page.url === url))) return jobs

  return attachInventoryDelegationEvidence(jobs, {
    source: 'fedilityinvestments', sources: ['fidelity'], preservesChildSourceAndCompany: true,
    verifiedAt: new Date(Math.min(...clocks)).toISOString(),
    evidence: { method: 'official-canonical-fidelity-careers-delegation', url: HOME,
      responses: responses.map(({ url, finalUrl, status, sha256 }) => ({ url, finalUrl, status, sha256 })) },
  })
}
