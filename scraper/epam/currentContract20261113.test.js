import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run } from './script.js'

const directory = new URL('./fixtures/current-20261113/', import.meta.url)
const receipts = JSON.parse(readFileSync(new URL('receipts.json', directory)))
const sha = value => createHash('sha256').update(value).digest('hex')
const packets = receipts.map(receipt => {
  const body = gunzipSync(readFileSync(new URL(receipt.file, directory)))
  assert.equal(body.length, receipt.bytes)
  assert.equal(sha(body), receipt.sha256)
  return { ...receipt, body }
})
const evidenceKey = Symbol.for('jobverify.epam-native-inventory')
const firstPayload = JSON.parse(packets.find(row => row.requestedUrl.includes('&from=0&')).body)
const selectedId = firstPayload.data.jobs[0].unique_id

test.beforeEach(t => t.mock.method(globalThis, 'fetch', async () => assert.fail('Unrecorded network in EPAM current contract regression')))

async function replay({ mutateRecord, changeResponse } = {}) {
  const calls = [], unrecorded = [], mutations = []
  const jobs = await run({ transport: async (url, init) => {
    calls.push(url)
    assert.equal(init.method, 'GET')
    assert.equal(init.redirect, 'manual')
    const packet = packets.find(row => row.requestedUrl === url)
    if (!packet) {
      unrecorded.push(url)
      throw Error('Missing actual response for ' + url)
    }
    let body = Buffer.from(packet.body)
    if (mutateRecord) {
      const change = record => {
        if (record?.unique_id !== selectedId) return
        const before = sha(JSON.stringify(record))
        mutateRecord(record)
        assert.notEqual(sha(JSON.stringify(record)), before)
        mutations.push(url)
      }
      if (packet.contentType?.startsWith('application/json') || packet.headers?.['content-type']?.startsWith('application/json')) {
        const data = JSON.parse(body)
        data.data?.jobs?.forEach(change)
        body = Buffer.from(JSON.stringify(data))
      } else if (body.includes(Buffer.from('id="__NEXT_DATA__"'))) {
        const html = body.toString('utf8')
        const match = /<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)
        assert.ok(match)
        const data = JSON.parse(match[1]), props = data.props.pageProps
        props.jobs?.jobs?.forEach(change)
        props.initialJobs?.jobs?.forEach(change)
        if (props.job) change(props.job)
        body = Buffer.from(html.replace(match[1], JSON.stringify(data)))
      }
    }
    const response = { url: packet.url, status: packet.status,
      headers: packet.headers || { 'content-type': packet.contentType }, body }
    return changeResponse ? changeResponse(response, url) : response
  } })
  assert.deepEqual(unrecorded, [], 'Fixture gaps cannot masquerade as a qualified source hold')
  return { jobs, audit: jobs[evidenceKey], calls, mutations }
}

test('the current acquired EPAM client and all six exact native pages remain inspectable', () => {
  assert.equal(packets.length, 25)
  const client = packets.find(row => row.requestedUrl.endsWith('/pages/_app-2958ad34104c68a4.js'))
  assert.equal(sha(client.body), '3587c063618bc4345e8afcc8da28928bda2498b9585026baa89fa1cb2d792247')
  const native = packets.filter(row => row.requestedUrl.includes('/api/jobs/v2/search/'))
    .flatMap(row => JSON.parse(row.body).data.jobs)
  assert.equal(native.length, 256)
  assert.equal(new Set(native.map(row => row.unique_id)).size, 256)
})

test('the reviewed current program admits complete native India vacancies while retaining company and cleanup limits', async () => {
  const { jobs, audit } = await replay()
  assert.equal(audit.controllerVerified, true)
  assert.equal(audit.passes[0].rawCount, 256)
  assert.equal(audit.closingMatches, true)
  assert.ok(jobs.length > 0, 'The actual current native acquisition must produce qualified roles')
  for (const job of jobs) {
    assert.equal(job.country, 'India')
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.nativeRecord.application_type, 'full-self-service')
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.ok(job.jobDescription.includes('Requirements'))
  }
})

for (const [name, mutateRecord] of [
  ['offscreen original description', record => { record.description = '<div style="position:fixed;left:-9999px">' + record.description + '</div>' }],
  ['hidden authored requirement', record => { record.category.requirements[0] = '<span hidden>' + record.category.requirements[0] + '</span>' }],
  ['unknown authored criteria member', record => { record.employmentConditions = 'Applicants must hold an additional original qualification.' }],
  ['unsupported native application mode', record => { record.application_type = 'unreviewed-contact-only' }],
]) test(`current EPAM holds ${name} and retains its complete native observation`, async () => {
  const { jobs, audit, mutations } = await replay({ mutateRecord })
  assert.ok(mutations.length > 0)
  assert.equal(jobs.some(job => job.nativeUniqueId === selectedId), false)
  assert.ok(audit.invalidRecords.some(row => row.nativeRecord?.unique_id === selectedId))
  assert.equal(audit.cleanupAllowed, false)
})
