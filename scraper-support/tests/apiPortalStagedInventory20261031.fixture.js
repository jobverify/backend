import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
import { getScraperCatalog } from '../providers/index.js'

export const capturedStagedInput = JSON.parse(gunzipSync(readFileSync(new URL('../apiPortal/test-data/staged-inventory-20261031.json.gz', import.meta.url))))
export const capturedStagedRows = capturedStagedInput.pairs.map(pair => pair.record)
export const stagedProvider = ({ staged = true, pagination = {}, detail = {}, timeoutMs = 5000 } = {}) => {
  const provider = structuredClone(getScraperCatalog().find(provider => provider.source === 'qualcomm'))
  provider.scraperTimeoutMs = timeoutMs
  delete provider.config.pagination.traversalMode
  Object.assign(provider.config.pagination, { pageSize: 2 }, staged ? { traversalMode: 'staged-snapshot' } : {}, pagination)
  Object.assign(provider.config.detail, { concurrency: 2 }, detail)
  provider.config.rateLimit = { minimumIntervalMs: 0, maxRetries: 1, baseDelayMs: 0, maxDelayMs: 0 }
  return provider
}

// Native records/details are unchanged captures. Only cohort membership,
// pagination/count envelopes and explicit negative mutations are controlled.
export const stagedReplay = ({ opening = capturedStagedRows.slice(0, 3), closing = opening,
  listingAction, detailAction } = {}) => {
  const events = []
  let phase = 'opening', openingComplete = false
  return { events, fetchJson: async (url, options) => {
    const address = new URL(url)
    if (address.pathname === '/api/pcsx/search') {
      const start = Number(address.searchParams.get('start')), limit = Number(address.searchParams.get('limit'))
      if (start === 0 && openingComplete) phase = 'closing'
      const rows = phase === 'opening' ? opening : closing
      const payload = structuredClone(capturedStagedInput.searchEnvelope)
      Object.assign(payload.data, { count: rows.length, positions: structuredClone(rows.slice(start, start + limit)), hasMore: start + limit < rows.length })
      const event = { kind: 'listing', phase, start, url }; events.push(event)
      const result = listingAction ? await listingAction({ ...event, payload, options }) : payload
      if (phase === 'opening' && start + limit >= rows.length) openingComplete = true
      return result
    }
    assert.equal(address.pathname, '/api/pcsx/position_details')
    const id = address.searchParams.get('position_id'), pair = capturedStagedInput.pairs.find(pair => String(pair.record.id) === id)
    assert.ok(pair, 'Uncaptured native detail: ' + id)
    const payload = structuredClone(pair.detail), event = { kind: 'detail', id, url }; events.push(event)
    return detailAction ? await detailAction({ ...event, payload, options }) : payload
  } }
}
