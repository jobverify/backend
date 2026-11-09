import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'

// Closing-proof tests use the two original roles whose own captured application
// responses are HTTP 200. The full four-role interruption is covered separately
// by recruitmentGoal20261104WaymoReadStop.test.js; no challenge body becomes 200.
const original = JSON.parse(gunzipSync(fs.readFileSync(new URL('./2026-10-31-native-packets.json.gz', import.meta.url))))
const available = new Set(original.filter(p => p.roleUrl && p.status === 200).map(p => p.roleUrl))
if (available.size !== 2) throw Error('Expected two original accessible Waymo application models')

export const accessibleNativePackets = original.map(packet => {
  if (!packet.url.includes('/jobs/search?')) return packet
  let kept = 0
  const body = packet.body.replace(/<article\b[\s\S]*?<\/article>/gi, article => {
    if (!article.includes('job-search-results-card-col')) return article
    if (![...available].some(url => article.includes(url))) return ''
    kept++
    return article
  }).replace('all&nbsp;4', 'all&nbsp;2')
  if (kept !== 2) throw Error('Two original role cards must remain in the test-only inventory')
  return {...packet, body}
})
