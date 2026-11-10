import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
export const billEaseCapture = () => JSON.parse(gunzipSync(readFileSync(new URL('../../../scraper/billease/fixtures/native-20261026.json.gz', import.meta.url))))
export const billEaseNativeOptions = (mutate = () => {}) => {
  const fixture = billEaseCapture(), calls = [], counts = new Map()
  const fetchPage = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    calls.push(url)
    const index = counts.get(url) || 0; counts.set(url, index + 1)
    const packet = structuredClone(fixture.packets.find(packet => packet.url === url))
    if (!packet) throw Error('Unexpected BillEase fixture request: ' + url)
    mutate(packet, index)
    return { ...packet, url: packet.finalUrl }
  }
  return { calls, now: () => fixture.runAt, fetchPage,
    fetchText: async (url, init) => (await fetchPage(url, init)).body,
    fetchJson: async (url, init) => JSON.parse((await fetchPage(url, init)).body),
  }
}
// Change only role-owned location fields, preserving the captured page structure.
export const billEaseIndiaRole = (packet, id = 'e4a2c8c0-7687-4e82-af62-21be3c64f7ee') => {
  if (packet.name.startsWith('native-board')) packet.body = packet.body.replace(/<article\b[\s\S]*?<\/article>/g, article =>
    article.includes('data-job-id="' + id + '"') ? article.replace(/data-job-country="[^"]*"/g, 'data-job-country="India"')
      .replace(/data-job-city="[^"]*"/g, 'data-job-city="Bengaluru"')
      .replace(/(<li\b[^>]*>[\s\S]*?<\/svg>)[\s\S]*?(<\/li>)/, '$1 Bengaluru, Karnataka, India $2') : article)
  if (packet.url.endsWith('/jobs/' + id)) packet.body = packet.body.replace(/(<div class="job-location[\s\S]*?<li\b[^>]*>[\s\S]*?<\/svg>)[\s\S]*?(<\/li>)/, '$1 Bengaluru, Karnataka, India $2')
}
export const billEaseSingleForeignRole = packet => {
  const id = 'e4a2c8c0-7687-4e82-af62-21be3c64f7ee'
  if (packet.name === 'corporate') packet.body = packet.body.replace('46 open roles', '1 open roles').replace('>46</strong>', '>1</strong>')
    .replace(/<a\b[^>]*href="https:\/\/billease\.careers-page\.com\/jobs\/[^"]+"[^>]*>[\s\S]*?<\/a>/g, anchor => anchor.includes(id) ? anchor : '')
  if (packet.name === 'corporate-payload') {
    const payload = JSON.parse(packet.body), reactive = payload[payload[0].data], data = payload[reactive[1]], state = payload[data['billease-career-jobs']]
    payload[state.jobs] = payload[state.jobs].slice(0, 1); packet.body = JSON.stringify(payload)
  }
  if (packet.name === 'native-board-1') {
    let index = 0
    packet.body = packet.body.replace(/<article\b[\s\S]*?<\/article>/g, article => index++ ? '' : article.replaceAll('data-job-country=""', 'data-job-country="Philippines"'))
      .replace(/48(?=\s*Open Positions)/, '1').replace('Page 1 of 2', 'Page 1 of 1')
      .replaceAll(BOARD_URL + '?page=2', BOARD_URL + '?page=1')
      .replace(/<a\b[^>]*href="\/candidate\/profile\?tab=internal_jobs"[^>]*>[\s\S]*?<\/a>/g, '')
  }
}
const BOARD_URL = 'https://billease.careers-page.com/'
