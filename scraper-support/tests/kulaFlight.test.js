import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/kula/acko-flight-description.json', import.meta.url), 'utf8'))
const frame = text => '<script>self.__next_f.push(' + JSON.stringify([1, text]) + ')</script>'
const textRecord = (id, text) => id + ':T' + Buffer.byteLength(text).toString(16) + ',' + text
const row = (description = '$a') => ({ id: 1, title: 'Engineer', ats_job: { job_description: description, offices: [{ country: 'India' }] } })
const resolve = async (html, rows) => (await import('../utils/kulaFlight.js')).resolveKulaJobDescriptions(html, rows)
const extractNative = async (html, accountName = 'acko') => (await import('../utils/kulaFlight.js')).extractKulaNativeJobs(html, { accountName })

test('Kula resolves the exact current native ACKO description reference without changing identity or location', async () => {
  const records = [fixture.job]
  const output = await resolve(frame(textRecord(fixture.reference, fixture.description)), records)
  assert.equal(output[0].ats_job.job_description, fixture.description)
  assert.equal(Buffer.byteLength(output[0].ats_job.job_description), fixture.byteLength)
  assert.deepEqual({ ...output[0], ats_job: { ...output[0].ats_job, job_description: null } }, { ...fixture.job, ats_job: { ...fixture.job.ats_job, job_description: null } })
  assert.equal(records[0].ats_job.job_description, '$27')
})

test('Kula respects UTF8 byte lengths and joins Flight chunks split within a text record/header', async () => {
  const first = '<p>Build caf\u00e9 systems \u2014 \u6771\u4eac. Keep 0: literal text.</p>'
  const second = '<p>A separate role.</p>'
  const stream = textRecord('a', first) + textRecord('b', second)
  const html = frame(stream.slice(0, 3)) + frame(stream.slice(3, 19)) + frame(stream.slice(19))
  const result = await resolve(html, [row('$a'), row('$b')])
  assert.deepEqual(result.map(x => x.ats_job.job_description), [first, second])
})

test('Kula accepts native resource hints, inline descriptions and referenced JSON string records', async () => {
  const html = frame(':HL["/style.css","style"]\na:' + JSON.stringify('<p>Native role text.</p>') + '\n')
  const result = await resolve(html, [row('$a'), row('<p>Inline text.</p>')])
  assert.deepEqual(result.map(x => x.ats_job.job_description), ['<p>Native role text.</p>', '<p>Inline text.</p>'])
  assert.equal((await resolve('legacy embedded jobs only', [row('$a')]))[0].ats_job.job_description, '$a')
})

for (const [label, html] of [
  ['unknown reference', frame(textRecord('b', '<p>Different role.</p>'))],
  ['conflicting record', frame(textRecord('a', '<p>First.</p>') + textRecord('a', '<p>Another.</p>'))],
  ['truncated payload', frame('a:T20,<p>too short</p>')],
  ['invalid byte boundary', frame('a:T1,\u00e9')],
  ['malformed length', frame('a:Twat,<p>text</p>')],
  ['nontext reference', frame('a:{"not":"role text"}\n')],
  ['cyclic reference', frame('a:"$b"\nb:"$a"\n')],
  ['React symbol reference', frame('a:"$Sreact.fragment"\n')],
  ['executable argument', '<script>self.__next_f.push([1,globalThis.__kula_executed=true])</script>'],
]) test('Kula rejects ' + label + ' rather than borrowing unrelated employer content', async () => {
  globalThis.__kula_executed = false
  await assert.rejects(resolve(html, [row()]), e => e.name === 'KulaFlightContractError')
  assert.equal(globalThis.__kula_executed, false)
  delete globalThis.__kula_executed
})

test('Kula native job extraction requires one exact account-scoped Flight model', async () => {
  const scope = { accountName: 'acko', jobs: [row()], departments: [], locations: [] }
  assert.deepEqual(await extractNative(frame('0:' + JSON.stringify({ nested: scope }) + '\n')), scope.jobs)
  await assert.rejects(extractNative(frame('0:' + JSON.stringify(scope) + '\n'), 'other'), e => e.name === 'KulaFlightContractError')
  for (const model of [
    { ...scope, locations: undefined },
    { ...scope, jobs: [row(), row()] },
    { one: scope, two: { ...scope, jobs: [{ ...row(), id: 2 }] } },
  ]) await assert.rejects(extractNative(frame('0:' + JSON.stringify(model) + '\n')), e => e.name === 'KulaFlightContractError')
  await assert.rejects(extractNative('legacy fragment'), e => e.name === 'KulaFlightContractError')
})

for (const source of ['acko', 'plumhq', 'goodera', 'clevertap']) test(source + ' parser resolves native Flight content and preserves existing India selection', async () => {
  const module = await import('../../scraper/' + source + '/script.js')
  const jobs = [structuredClone(fixture.job), { ...structuredClone(fixture.job), id: 99999, title: 'Foreign role', ats_job: { ...fixture.job.ats_job, offices: [{ country: 'United States', location: 'Boston, United States' }] } }]
  const model = '0:' + JSON.stringify({ jobs, departments: [] }) + '\n'
  const html = frame(model + textRecord(fixture.reference, fixture.description))
  const rows = module.extractSearchResults(html)
  assert.ok(rows.some(j => j.jobId === String(fixture.job.id)))
  assert.ok(rows.filter(j => j.jobId === String(fixture.job.id)).every(hasSourceDescription))
  if (source !== 'acko') assert.equal(rows.some(j => j.jobId === '99999'), false)
})

for (const source of ['acko', 'plumhq', 'goodera', 'clevertap']) test(source + ' maps validated native rows with the same existing source rules', async () => {
  const module = await import('../../scraper/' + source + '/script.js')
  assert.equal(typeof module.mapKulaJobs, 'function')
  const jobs = [structuredClone(fixture.job), { ...structuredClone(fixture.job), id: 99999, title: 'Foreign role', ats_job: { ...fixture.job.ats_job, offices: [{ country: 'United States', location: 'Boston, United States' }] } }]
  const html = frame('0:' + JSON.stringify({ accountName: source, jobs, departments: [], locations: [] }) + '\n'
    + textRecord(fixture.reference, fixture.description))
  const native = await extractNative(html, source)
  const resolved = await resolve(html, native)
  const before = structuredClone(resolved)
  assert.deepEqual(module.mapKulaJobs(resolved), module.extractSearchResults(html))
  assert.deepEqual(resolved, before)
  assert.ok(module.mapKulaJobs(resolved).every(hasSourceDescription))
})

test('Kula normal runs retain the reconciliation guard after all observed descriptions resolve', async () => {
  for (const [source, factory] of [['acko', 'createAckoScraper'], ['clevertap', 'createCleverTapScraper']]) {
    const module = await import('../../scraper/' + source + '/script.js')
    const html = frame('0:' + JSON.stringify({ jobs: [fixture.job], departments: [] }) + '\n'
      + textRecord(fixture.reference, fixture.description))
    const jobs = await module[factory]().run({ fetchText: async () => html })
    assert.equal(jobs.length, 1)
    assert.ok(jobs.every(hasSourceDescription))
    assert.ok(jobs.every(job => job.sourceListingComplete === false))
  }
})
