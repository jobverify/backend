import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const magnitCapture = () => JSON.parse(gunzipSync(readFileSync(new URL('../../../scraper/magnitglobal/fixtures/native-20261026.json.gz', import.meta.url))))
const requestKey = (url, method, body) => {
  const normalize = value => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])) : value
  return [url, method || 'GET', body ? JSON.stringify(normalize(JSON.parse(body))) : ''].join('|')
}
export const magnitNativeOptions = (mutate = () => {}, fixture = magnitCapture()) => {
  const calls = [], counts = new Map()
  const fetchPage = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    const key = requestKey(url, init.method, init.body), index = counts.get(key) || 0
    counts.set(key, index + 1); calls.push({ url, method: init.method || 'GET', body: init.body || null })
    const packet = structuredClone(fixture.packets.filter(packet => requestKey(packet.url, packet.method, packet.requestBody) === key)[index])
    if (!packet) throw Error('Unexpected Magnit fixture request: ' + key)
    mutate(packet, index)
    return { ...packet, url: packet.finalUrl, setCookies: (packet.setCookieNames || []).map(name => name + '=public-fixture-cookie') }
  }
  return { calls, now: () => fixture.runAt, fetchPage,
    fetchText: async (url, init) => (await fetchPage(url, init)).body,
    fetchJson: async (url, init) => JSON.parse((await fetchPage(url, init)).body) }
}
const nativeIndiaLocation = location => ({ ...location, isoCountryCode: 'IN', cityName: 'Bengaluru', stateCode: 'KA',
  formattedAddress: 'Bengaluru, Karnataka, India', coordinates: typeof location.coordinates === 'string' ? 'lat:12.9716;lng:77.5946' : { lat: 12.9716, lng: 77.5946 } })
export const magnitDayforceIndiaRole = packet => {
  const alter = value => {
    if (value?.jobPostingId === 7493) value.postingLocations = value.postingLocations.map(nativeIndiaLocation)
    return value
  }
  if (packet.url.includes('/jobposting/search')) {
    const data = JSON.parse(packet.body); data.jobPostings.forEach(alter); packet.body = JSON.stringify(data)
  }
  if (packet.name === 'dayforce-detail-7493') packet.body = JSON.stringify(alter(JSON.parse(packet.body)))
  if (packet.name === 'dayforce-page-7493') packet.body = packet.body.replace(/(<script\b[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,
    (all, start, raw, end) => { const next = JSON.parse(raw); next.props.pageProps.dehydratedState.queries.forEach(query => alter(query.state.data)); return start + JSON.stringify(next) + end })
}
export const magnitDirectIndiaRole = packet => {
  if (packet.name !== 'directsource-detail-0') return
  packet.body = packet.body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,
    (all, start, raw, end) => {
      const value = JSON.parse(raw)
      value.jobLocation.address = { ...value.jobLocation.address, addressCountry: 'IN', addressLocality: 'Bengaluru', addressRegion: 'Karnataka' }
      return start + JSON.stringify(value) + end
    })
  packet.body = packet.body.replaceAll('Warsaw', 'Bengaluru').replaceAll('Mazowieckie', 'Karnataka')
}

// Synthetic future pagination scenario derived from the captured public contract.
// Its 26 rows and generated IDs are regression data, never live inventory evidence.
export const magnitTwoPageCapture = () => {
  const fixture = magnitCapture(), original = fixture.packets.find(p => p.name === 'initial-search-en-US-0')
  const rows = JSON.parse(original.body).jobPostings
  const extra = Array.from({ length: 21 }, (_, index) => ({ ...structuredClone(rows[0]), jobPostingId: 9000 + index, jobReqId: 19000 + index }))
  for (const stage of ['initial', 'closing']) {
    const first = fixture.packets.find(p => p.name === stage + '-search-en-US-0')
    const combined = [...rows, ...extra], data = JSON.parse(first.body)
    first.body = JSON.stringify({ ...data, jobPostings: combined.slice(0, 25), count: 25, maxCount: 26 })
    fixture.packets.push({ ...structuredClone(first), name: stage + '-search-en-US-25',
      requestBody: JSON.stringify({ ...JSON.parse(first.requestBody), paginationStart: 25 }),
      body: JSON.stringify({ ...data, jobPostings: combined.slice(25), offset: 25, count: 1, maxCount: 26 }) })
  }
  for (const row of extra) {
    for (const kind of ['detail', 'page']) {
      const packet = structuredClone(fixture.packets.find(p => p.name === 'dayforce-' + kind + '-7493'))
      packet.name = 'dayforce-' + kind + '-' + row.jobPostingId
      packet.url = packet.url.replace(/7493$/, String(row.jobPostingId)); packet.finalUrl = packet.url
      if (kind === 'detail') {
        const detail = JSON.parse(packet.body)
        detail.jobPostingId = row.jobPostingId; detail.jobReqId = row.jobReqId
        packet.body = JSON.stringify(detail)
      } else packet.body = packet.body.replace(/(<script\b[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,
        (all, start, raw, end) => {
          const next = JSON.parse(raw)
          next.query.id = String(row.jobPostingId)
          for (const query of next.props.pageProps.dehydratedState.queries) {
            if (query.queryKey?.[0] === 'site-info') query.queryKey[1].jobPostingId = String(row.jobPostingId)
            if (query.queryKey?.[0] === 'jobs') {
              query.queryKey[2].id = String(row.jobPostingId)
              query.state.data.jobPostingId = row.jobPostingId; query.state.data.jobReqId = row.jobReqId
            }
          }
          return start + JSON.stringify(next) + end
        })
      fixture.packets.push(packet)
    }
  }
  return fixture
}
