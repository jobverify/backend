import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'

const load = path => JSON.parse(gunzipSync(readFileSync(new URL(path, import.meta.url))))
const currentSearch = load('./test-data/deployment-20261124/search.json.gz')
const currentClient = load('./test-data/deployment-20261124/client.json.gz')
const currentDescription = load('./test-data/deployment-20261124/description-client.json.gz')
const manifest = JSON.parse(readFileSync(new URL('./fixtures/manifest-20261111.json', import.meta.url)))
const packets = new Map(manifest.receipts.map(row => [row.requestedURL, {
  body: gunzipSync(readFileSync(new URL('./fixtures/' + row.fixture, import.meta.url))).toString(),
  type: row.headers['content-type'],
}]))
const searchUrl = manifest.receipts.find(row => row.fixture === 'native-search-20261111.gz').requestedURL
packets.set(searchUrl, { body: currentSearch.body, type: currentSearch.headers['content-type'] })
packets.set(currentClient.requestedUrl, { body: currentClient.body, type: currentClient.headers['content-type'] })
packets.set(currentDescription.requestedUrl, { body: currentDescription.body, type: currentDescription.headers['content-type'] })
// The current literal page configuration also requests two facet controls.
// Replay the captured native role model at that declared query, independently
// of today's changing role count; every returned role is still fully checked.
const api = manifest.receipts.find(row => row.fixture === 'native-api-page-1-20261111.gz').requestedURL
packets.set('https://jobs.echostar.com/api/jobs?location=India&page=1&internal=false&separator=%257C&facetField=tags4%257Ctags1', packets.get(api))
const replay = (change, { activeDescription = false, onRequest = () => {}, maxDetails } = {}) => run({ ...(maxDetails === undefined ? {} : { maxDetails }), fetchImpl: async url => {
  onRequest(url)
  if (activeDescription) assert.notEqual(url, 'https://app.jibecdn.com/prod/descriptions/1.1.100/main.js', 'The current role must not borrow a retired description renderer')
  const packet = activeDescription && url === currentDescription.requestedUrl
    ? { body: currentDescription.body, type: currentDescription.headers['content-type'] } : packets.get(url)
  assert.ok(packet, 'Unadvertised public URL ' + url)
  // Rebind only the executable asset declaration on the captured role model;
  // employer, native criteria, locations and publication remain independent.
  const body = activeDescription && /\/jobs\/\d+\?lang=/.test(url)
    ? packet.body.replaceAll('/descriptions/1.1.100/', '/descriptions/1.1.102/') : packet.body
  const response = new Response(change?.(url, body) ?? body, { headers: { 'content-type': packet.type } })
  return Object.defineProperty(response, 'url', { value: url })
} })

test('EchoStar declares the November 24 renderer before validating the four captured native India roles', async () => {
  const jobs = await replay()
  assert.deepEqual(jobs.map(job => job.jobId), ['98606', '97540', '95713', '97514'])
  assert.ok(jobs.every(job => job.country === 'India' && job.sourceDetailComplete && job.lifecycleCleanupAllowed === false))
})

test('the newly declared EchoStar renderer cannot alter native search country or criteria semantics', async () => {
  await assert.rejects(replay((url, body) => url === currentClient.requestedUrl ? body + ';changedNativeQuery()' : body), /renderer|client/)
})

test('EchoStar verifies the active full-description renderer at opening and closing without requesting its predecessor', async () => {
  const calls = []
  const jobs = await replay(undefined, { activeDescription: true, onRequest: url => calls.push(url) })
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.country === 'India'))
  assert.ok(jobs.every(job => job.nativeCriteriaRepresentations.currentRendererURL === 'https://app.jibecdn.com/prod/descriptions/1.1.102/main.js'
    && job.nativeCriteriaRepresentations.currentRendererSHA256 === 'e66eecfab3dda1f09240cccfca8f6a28ac0960d3051382f03d3c527a1e3fbac3'))
  assert.equal(calls.filter(url => url === currentDescription.requestedUrl).length, 2)
})

test('EchoStar rejects changed bytes in its currently declared full-description renderer', async () => {
  await assert.rejects(replay((url, body) => url === currentDescription.requestedUrl ? body + ';changedDescription()' : body,
    { activeDescription: true }), /description renderer changed/)
})

test('EchoStar rejects a closing role switching between two reviewed description renderer versions', async () => {
  let reads = 0
  await assert.rejects(replay((url, body) => {
    if (url !== 'https://jobs.echostar.com/jobs/98606?lang=en-us' || ++reads !== 2) return body
    return body.replaceAll('/descriptions/1.1.102/', '/descriptions/1.1.100/')
  }, { activeDescription: true }), /closing native description renderer declaration changed/)
})

test('EchoStar reserves both opening and closing reads when distinct roles declare two reviewed description renderers', async () => {
  const calls = []
  const jobs = await replay((url, body) => url === 'https://jobs.echostar.com/jobs/98606?lang=en-us'
    ? body.replaceAll('/descriptions/1.1.100/', '/descriptions/1.1.102/') : body,
  { maxDetails: 4, onRequest: url => calls.push(url) })
  assert.equal(jobs.length, 4)
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.lifecycleCleanupAllowed === false))
  assert.equal(calls.length, 24)
  for (const version of ['1.1.100', '1.1.102']) {
    assert.equal(calls.filter(url => url === 'https://app.jibecdn.com/prod/descriptions/' + version + '/main.js').length, 2)
  }
})
