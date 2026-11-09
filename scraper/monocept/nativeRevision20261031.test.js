import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { nativeShellContract, clientContract, BOARD_URL, DASHBOARD_URL, NATIVE_ORIGIN } from './nativeContract.js'
import { run } from './script.js'
import { nativeOptions } from './fixtures/options.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const { shell, clients } = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/native-build-20261031.json.gz', import.meta.url))))
const packets = new Map(clients.map(packet => [NATIVE_ORIGIN + new URL(packet.url).pathname, packet]))
const MAIN = NATIVE_ORIGIN + '/main.83be12cc773959e07faa.chunk.js'
const OLD_MAIN = NATIVE_ORIGIN + '/main.4d05cc901a9accc19b6c.chunk.js'
const currentOptions = changeClient => {
  const options = nativeOptions()
  return { ...options, fetchImpl: async (url, init) => {
    const packet = [BOARD_URL, DASHBOARD_URL].includes(url) ? shell : packets.get(url)
    if (packet) return { status: packet.status, url, contentType: packet.contentType, body: changeClient && url === MAIN ? changeClient(packet.body) : packet.body }
    return options.fetchImpl(url, init)
  } }
}

test('current Monocept native shell preserves the reviewed public application context', () => {
  const native = nativeShellContract(shell.body)
  assert.ok(native.clientURLs.includes(MAIN))
  assert.deepEqual(native.frames, [])
  assert.deepEqual(native.hiringLinks, [])
})

test('current Monocept native build fetches its advertised client version and reconciles captured roles', async () => {
  const jobs = await run(currentOptions())
  assert.equal(jobs.length, 7)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  const responses = jobs.nativeInventoryEvidence.retainedResponses
  assert.ok(responses.some(packet => packet.url === MAIN))
  assert.equal(responses.some(packet => packet.url === OLD_MAIN), false)
})

test('changed current Monocept client bytes cannot silently alter the public listing contract', async () => {
  await assert.rejects(run(currentOptions(body => body + '\nwindow.moreJobs="/jobs";')), /unreviewed current native client bytes/)
})

test('every captured current Monocept public client must match the reviewed bytes', () => {
  for (const [url, packet] of packets) assert.equal(clientContract(url, packet.body), packet.bodySHA256)
})

for (const [label, change] of [
  ['duplicate client with an absolute URL alias', html => html.replace('<script src="/main.83be12cc773959e07faa.chunk.js">', '<script src="https://monocept.turbohire.co/18.686c2629fe7c78598547.chunk.js">')],
  ['mixed reviewed builds', html => html.replace('runtime-main.9522a0a57370b3c3a0b4.js', 'runtime-main.b10416b6ebb29396fa10.js')],
  ['unreviewed main client', html => html.replace('main.83be12cc773959e07faa.chunk.js', 'main.unreviewed.chunk.js')],
  ['hidden public root', html => html.replace('<div id="root">', '<div hidden id="root">')],
  ['additional executable client', html => html.replace('</body>', '<script>window.moreJobs="/jobs"</script></body>')],
]) test('current Monocept native shell rejects ' + label, () => {
  const html = change(shell.body)
  assert.notEqual(html, shell.body)
  assert.throws(() => nativeShellContract(html))
})
