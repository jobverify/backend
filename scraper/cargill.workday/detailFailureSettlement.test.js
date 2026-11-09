import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { setImmediate, setTimeout as sleep } from 'node:timers/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import { runNativeCargill } from './nativeRun.js'
import { HOME, CAREERS, SEARCH, CLIENT, CORE, parseCargillPage } from './nativeContract.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261021.json.gz', import.meta.url))))
const allRows = fixture.pages.flatMap((page, index) => parseCargillPage(page, index + 1, 81).jobs)
const rows = fixture.roles.slice(0, 3).map(role => allRows.find(row => row.sourceUrl === role.public.url))
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
const payload = {
  hasJobs: true, hasContent: false,
  filters: '<input type="checkbox" checked data-facet-type="2" data-id="1269750" data-display="India" data-count="3">',
  results: '<section id="search-results" data-total-results="3" data-total-job-results="3" data-total-pages="1" data-current-page="1" data-records-per-page="15">'
    + rows.map(row => `<a data-job-id="${row.publicJobId}" href="${row.sourceUrl}"><h3>${escape(row.title)}</h3><span class="job-location">${escape(row.nativeListingLocation)}</span></a>`).join('') + '</section>',
}

for (const phase of ['fetch', 'body']) test('one failed native role waits for cooperative sibling ' + phase + ' abort cleanup', async () => {
  let active = 0
  const cleanup = []
  const fetchImpl = async (url, { signal }) => {
    const body = url === HOME ? fixture.corporate : url === CAREERS ? fixture.careers
      : url === SEARCH ? fixture.search.replace('data-count="81"\n', 'data-count="3"\n').replace(/(data-id="1269750"[^>]*data-count=")81"/, '$13"')
        : url === CLIENT ? fixture.client : url === CORE ? fixture.core : url.startsWith(SEARCH + '/results?') ? JSON.stringify(payload) : null
    if (body !== null) return { status: 200, url: url === CAREERS ? CAREERS + 'en' : url, text: async () => body }
    if (url === rows[0].sourceUrl) {
      await setImmediate()
      return { status: 503, url, text: async () => 'Unavailable' }
    }
    assert.ok(rows.slice(1).some(row => row.sourceUrl === url))
    active++
    const pending = new Promise((_, reject) => {
      let stopping = false
      const stop = () => {
        if (stopping) return
        stopping = true
        signal.removeEventListener('abort', stop)
        setTimeout(() => {
          active--
          reject(signal.reason || new Error('test cleanup'))
        }, 20)
      }
      cleanup.push(stop)
      signal.addEventListener('abort', stop, { once: true })
    })
    return phase === 'fetch' ? pending : { status: 200, url, text: () => pending }
  }
  try {
    await assert.rejects(runNativeCargill({ fetchImpl, now: '2026-10-21T03:00:00Z', timeoutMs: 1000 }), error => error.code === 'CARGILL_HTTP_OFFICIAL_ROLE_503')
    assert.equal(active, 0, 'Source failure must not clear its deadline while sibling native requests remain active')
  } finally { for (const stop of cleanup) stop(); await sleep(25) }
})
