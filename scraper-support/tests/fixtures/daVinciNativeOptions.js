import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const daVinciCapture = () => JSON.parse(gunzipSync(readFileSync(new URL('../../../scraper/davincitrading/fixtures/native-20261026.json.gz', import.meta.url))))
export const mutateDaVinciModel = (packet, mutate) => {
  packet.body = packet.body.replace(/(window\.__remixContext\s*=\s*)([\s\S]*?)(;<\/script>)/,
    (all, start, raw, end) => { const model = JSON.parse(raw); mutate(model.state.loaderData, model); return start + JSON.stringify(model) + end })
}
export const daVinciNativeOptions = (mutate = () => {}, fixture = daVinciCapture()) => {
  const calls = [], counts = new Map()
  const fetchPage = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    const index = counts.get(url) || 0
    counts.set(url, index + 1); calls.push({ url, method: init.method || 'GET' })
    const packet = structuredClone(fixture.packets.filter(packet => packet.url === url)[index])
    if (!packet) throw Error('Unexpected Da Vinci fixture request: ' + url)
    mutate(packet, index)
    return { ...packet, url: packet.finalUrl }
  }
  return { now: () => fixture.runAt, calls, fetchPage, fetchText: async (url, init) => (await fetchPage(url, init)).body }
}

// Synthetic 51-posting scenario exercises the captured 50-row native contract.
// Added public IDs are regression data and are never counted as recovered roles.
export const daVinciTwoPageCapture = () => {
  const fixture = daVinciCapture(), board = fixture.packets.find(p => p.name === 'initial-board')
  let original
  mutateDaVinciModel(structuredClone(board), data => { original = data['routes/$url_token'].jobPosts.data })
  const extras = Array.from({ length: 36 }, (_, index) => ({ ...structuredClone(original[0]), id: 9000000000 + index,
    absolute_url: 'https://job-boards.eu.greenhouse.io/davinciderivatives/jobs/' + (9000000000 + index) }))
  const combined = [...original, ...extras]
  for (const stage of ['initial', 'closing']) {
    const first = fixture.packets.find(p => p.name === stage + '-board'), second = structuredClone(first)
    for (const [page, packet] of [[1, first], [2, second]]) {
      const rows = combined.slice((page - 1) * 50, page * 50)
      mutateDaVinciModel(packet, data => { data['routes/$url_token'].jobPosts = { count: rows.length, page, total: 51, total_pages: 2, data: rows } })
      packet.body = packet.body.replaceAll('15 jobs', '51 jobs')
      if (page === 2) packet.body = packet.body.replace(/<a\b[^>]*href="https:\/\/job-boards\.eu\.greenhouse\.io\/davinciderivatives\/jobs\/\d+"[^>]*>[\s\S]*?<\/a>/g, '')
      const inserted = page === 1 ? rows.slice(original.length) : rows
      packet.body = packet.body.replace('</main>', inserted.map(row => '<a href="' + row.absolute_url + '">' + row.title + ' ' + row.location + '</a>').join('') + '</main>')
    }
    second.name = stage + '-board-page-2'; second.url += '?page=2'; second.finalUrl = second.url
    fixture.packets.push(second)
  }
  const prototype = fixture.packets.find(p => p.name === 'native-detail-' + original[0].id)
  for (const row of extras) {
    const packet = structuredClone(prototype)
    packet.name = 'native-detail-' + row.id; packet.url = row.absolute_url; packet.finalUrl = row.absolute_url
    packet.body = packet.body.replaceAll(String(original[0].id), String(row.id))
    fixture.packets.push(packet)
  }
  return fixture
}
