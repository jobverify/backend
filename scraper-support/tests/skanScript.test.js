import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { document } from '../shared/rmkNativePairHtml.js'
import * as skan from '../../scraper/skan/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const run = options => skan.run({ now: active.capturedAt, ...options })
const dir = new URL('../../scraper/skan/fixtures/', import.meta.url)
const read = name => JSON.parse(gunzipSync(readFileSync(new URL(name + '.json.gz', dir))))
const home = read('careers-response'), details = read('detail-responses')
const active = JSON.parse(readFileSync(new URL('additional-native-api-pages.json', dir)))[0]
const captures = [home, ...details, active]
const replay = async url => { const capture = captures.find(row => row.url === url); assert.ok(capture, url); return capture.body }
const changeJobs = mutate => home.body.replace(/<script>(self\.__next_f\.push\([\s\S]*?)<\/script>/g, (match, raw) => {
  if (!raw.includes('89302')) return match
  const args = JSON.parse(raw.slice('self.__next_f.push('.length, -1))
  const data = JSON.parse(args[1].slice(args[1].indexOf(':') + 1))
  data[3].jobs = mutate(data[3].jobs)
  args[1] = args[1].slice(0, args[1].indexOf(':') + 1) + JSON.stringify(data) + '\n'
  return '<script>self.__next_f.push(' + JSON.stringify(args) + ')</script>'
})

test('Skan reads all 65 embedded native roles beyond the 32 visible cards', () => {
  const inventory = skan.parseNativeListing(home.body)
  assert.equal(inventory.length, 65)
  assert.equal(inventory.filter(row => row.location === 'India').length, 17)
  assert.equal(document(home.body).nodes(node => node.tag === 'a' && node.attrs.href?.includes('/careers/jobdetails/')).length, 32)
})

test('Skan crosschecks native active roles and retains 16 India roles with native publication dates', async () => {
  const requested = []
  const jobs = await run({ fetchText: async url => { requested.push(url); return replay(url) } })
  assert.equal(jobs.length, 16)
  assert.equal(requested.length, 66)
  const job = jobs.find(job => job.jobId === '89302')
  assert.equal(job.title, 'Lead DevOps Engineer')
  assert.equal(job.country, 'India')
  assert.deepEqual(job.locations, ['India'])
  assert.match(job.jobDescription, /CI\/CD/)
  assert.equal(job.postingDate, '2026-09-21T09:47:32.277Z')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 65)
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('Skan rejects missing, duplicate, foreign and changed embedded inventory rows', () => {
  for (const mutate of [rows => rows.slice(1), rows => [...rows, rows[0]], rows => rows.map((row, index) => index ? row : { ...row, href: row.href.replace('skanai.', 'other.') }), rows => rows.map((row, index) => index ? row : { ...row, id: '999999' })]) {
    assert.throws(() => skan.parseNativeListing(changeJobs(mutate)), /Skan/)
  }
  for (const closing of ['</body>', '</html>']) assert.throws(() => skan.parseNativeListing(home.body.replace(closing, '')), /Skan|unclosed/)
})

test('Skan checks visible card and department count parity with the complete payload', () => {
  for (const html of [home.body.replace('Lead DevOps Engineer</p>', 'Different role</p>'), home.body.replace('(20)', '(21)'),
    home.body.replace('>Find your seat</h2>', '>Find your seat</h2><a href="https://careers.other.example/skan">New openings</a>'),
    changeJobs(rows => rows.map((row, index) => index ? row : { ...row, country: 'Canada' })),
  ]) {
    assert.throws(() => skan.parseNativeListing(html), /Skan/)
  }
})

test('Skan rejects changed detail IDs, titles, employer, locations, closed banner and disabled application', () => {
  const row = skan.parseNativeListing(home.body).find(row => row.id === '89302')
  const detail = details.find(capture => capture.url === row.href)
  for (const html of [detail.body.replaceAll('selectedJobId="89302"', 'selectedJobId="999999"'),
    detail.body.replace('>Lead DevOps Engineer</h1>', '>Different role</h1>'),
    detail.body.replace('>SkanAI</span>', '>Other</span>'),
    detail.body.replace('>India</span>', '>Canada</span>'),
    detail.body.replace('</body>', '<p>This job is no longer available</p></body>'),
    detail.body.replace('id="apply-job"', 'id="apply-job" disabled'),
    detail.body.replace('</body>', ''),
  ]) assert.throws(() => skan.parseNativeDetail(html, row), /Skan|unclosed/)
})

test('Skan retains missing, inert and heading-only descriptions as incomplete details', async () => {
  const selected = details.find(row => row.url.endsWith('/89302'))
  const doc = document(selected.body), node = doc.nodes(node => doc.hasClass(node, 'job-description-container'))[0]
  for (const content of ['', '<h3>Requirements</h3><p>&nbsp;</p>', '<div><strong>Requirements</strong></div>', '<div hidden>Real looking but hidden description</div><script>job text</script>']) {
    const html = selected.body.slice(0, node.openEnd) + content + selected.body.slice(node.closeStart)
    const jobs = await run({ fetchText: async url => url === selected.url ? html : replay(url) })
    const job = jobs.find(job => job.jobId === '89302')
    assert.equal(jobs.length, 16)
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceListingComplete, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})

test('Skan does not infer India from foreign contradictions or certify unknown secondary scope', () => {
  assert.throws(() => skan.classifyLocations('Bengaluru, Canada'), /Skan.*geograph/)
  assert.throws(() => skan.classifyLocations('Hyderabad, United States'), /Skan.*geograph/)
  assert.deepEqual(skan.classifyLocations('India, USA').india, ['India'])
  assert.equal(skan.classifyLocations('India, Remote').complete, false)
})

test('Skan propagates unavailable current official careers instead of certifying zero', async () => {
  await assert.rejects(run({ fetchText: async () => { throw new Error('official source unavailable') } }), /official source unavailable/)
})

test('Skan rejects unrecognized current careers markup', async () => {
  await assert.rejects(run({ fetchText: async () => '<html><body>Unknown current surface</body></html>' }), /Skan/)
})

test('Skan import with a parent dry-run flag has no file or network side effects', () => {
  const url = new URL('../../scraper/skan/script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw Error('unexpected import write'); };
    globalThis.fetch = () => { throw Error('unexpected import fetch'); };
    process.argv.push('--dry-run'); await import(${JSON.stringify(url)}); console.log('imported');
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(output.trim(), 'imported')
})

test('Skan bounds noncooperative transport and body reads and honors caller abort', () => {
  const url = new URL('../../scraper/skan/script.js', import.meta.url).href
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { run } from ${JSON.stringify(url)};
    const results = [];
    const keepAlive = setInterval(() => {}, 100);
    try {
      for (const mode of ['fetch', 'body', 'abort']) {
        const controller = new AbortController();
        const timer = mode === 'abort' ? setTimeout(() => controller.abort(Error('caller cancelled')), 10) : null;
        globalThis.fetch = async url => ({ status: 200, url, body: new ReadableStream() });
        try { await run({ signal: controller.signal, timeoutMs: mode === 'abort' ? 1000 : 15,
          ...(mode === 'body' ? {} : { fetchText: () => new Promise(() => {}) }) }); results.push('unexpected success'); }
        catch (error) { results.push(error.message); }
        finally { clearTimeout(timer); }
      }
      console.log(JSON.stringify(results));
    } finally { clearInterval(keepAlive); }
  `], { encoding: 'utf8', timeout: 2500 })
  const results = JSON.parse(output)
  assert.match(results[0], /timeout|timed out|deadline/i)
  assert.match(results[1], /timeout|timed out|deadline/i)
  assert.match(results[2], /caller cancelled/)
})
