import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { createBaswareScraper, CAREERS_URL } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { parseBaswareListing, parseBaswareDetail } from './native.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/native-20261031.json.gz', import.meta.url))))
const widgetURL = 'https://cdn.jobylon.com/jobs/company-groups/195/embed/v2/?target=jobylon-jobs-widget&page_size=5'
const detailURL = 'https://emp.jobylon.com/jobs/377460-basware-senior-cloud-developer/'
const sourceHTML = fixture.packets[CAREERS_URL].html
const detailHTML = fixture.packets[detailURL].html
const replay = (overrides = {}) => {
  const requests = []
  return {
    requests,
    // The historical implementation consumes only this page and loses all jobs.
    fetchText: async url => {
      assert.equal(url, CAREERS_URL)
      return overrides[url] ?? sourceHTML
    },
    transport: async url => {
      requests.push(url)
      const packet = fixture.packets[url]
      if (!packet) throw new Error('Unexpected native URL: ' + url)
      const value = overrides[url] ?? packet.html
      if (value instanceof Error) throw value
      return { url, status: packet.status, headers: { 'content-type': 'text/html; charset=utf-8' },
        body: Buffer.from(value), bodyComplete: true, requestedAt: packet.at, completedAt: packet.at }
    },
  }
}

test('Basware recovers the 17 captured India roles from all 25 widget rows, beyond its five-row display page size', async () => {
  const input = replay()
  const jobs = await createBaswareScraper().run(input)
  assert.equal(jobs.length, 17)
  assert.deepEqual(jobs.map(job => job.jobId), ['236286', '351872', '316812', '332734', '332730', '389785',
    '389021', '383709', '383707', '379794', '377460', '377439', '371749', '363883', '338875', '331852', '302210'])
  const job = jobs.find(job => job.jobId === '377460')
  assert.equal(job.title, 'Senior Cloud Developer')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Chandigarh')
  assert.equal(job.postingDate, '2026-08-21T07:18:19+00:00')
  assert.equal(job.applyUrl, 'https://emp.jobylon.com/applications/jobs/377460/create/')
  assert.match(job.sourceDescription, /REST APIs/)
  assert.match(job.sourceDescription, /5\+ years/)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(input.requests.filter(url => url === widgetURL).length, 2)
})

test('registered Basware execution exposes recovered jobs and their partial inventory evidence', async () => {
  const provider = getScraperCatalog().find(item => item.source === 'basware')
  const jobs = await createCatalogScraper(provider).run(replay())
  assert.equal(jobs.length, 17)
  assert.ok(jobs.every(job => job.source === 'basware' && job.company === 'Basware'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [name, replacement] of [
  ['commented widget configuration', html => html.replace('var jbl_group_id = 195;', '/* var jbl_group_id = 195; */')],
  ['different employer group', html => html.replace('var jbl_group_id = 195;', 'var jbl_group_id = 999;')],
  ['hidden widget target', html => html.replace('id="jobylon-jobs-widget"', 'id="jobylon-jobs-widget" hidden')],
]) {
  test(`Basware refuses ${name} before reading a native feed`, async () => {
    const input = replay({ [CAREERS_URL]: replacement(sourceHTML) })
    await assert.rejects(createBaswareScraper().run(input), /Basware|handoff|native/i)
    assert.deepEqual(input.requests, [CAREERS_URL])
  })
}

for (const [name, modify] of [
  ['foreign employer', html => html.replace('"name": "Basware"', '"name": "Another employer"')],
  ['hidden role content', html => html.replace('class="canvas-skills"', 'class="canvas-skills" hidden')],
  ['contradictory visible title', html => html.replace('<h1 class="job-title">Senior Cloud Developer</h1>', '<h1 class="job-title">Another role</h1>')],
  ['another role application', html => html.replaceAll('/applications/jobs/377460/create/', '/applications/jobs/999999/create/')],
  ['unqualified India address', html => html.replaceAll('Haryana, India', 'Haryana, Unknown')],
]) {
  test(`Basware excludes a detail with ${name} and retains the other proven roles`, async () => {
    const jobs = await createBaswareScraper().run(replay({ [detailURL]: modify(detailHTML) }))
    assert.equal(jobs.length, 16)
    assert.equal(jobs.some(job => job.jobId === '377460'), false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  })
}

test('Basware caller cancellation stops before any request', async () => {
  const controller = new AbortController()
  const reason = new Error('caller stopped Basware')
  controller.abort(reason)
  const input = replay()
  await assert.rejects(createBaswareScraper().run({ ...input, signal: controller.signal }), error => error === reason)
  assert.deepEqual(input.requests, [])
})

for (const statement of ['JBL.embed_v2.jobs.length = 0;', "JBL.embed_v2.jobs[2].company = 'Another employer';", 'JBL.embed_v2 = {};']) {
  test(`Basware rejects native data mutation: ${statement}`, () => {
    const widget = fixture.packets[widgetURL].html
    const script = [...widget.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
      .find(match => match[1].includes("JBL.embed_v2['jobs']"))[0]
    const changed = widget.replace(script, script.replace('</script>', statement + '</script>'))
    assert.throws(() => parseBaswareListing(changed))
  })
}

test('Basware rejects a visible country contradiction even when the city name still matches', () => {
  const row = parseBaswareListing(fixture.packets[widgetURL].html).records.find(row => row.id === '377460')
  const changed = detailHTML.replace('title="Chandigarh">\n                                Chandigarh',
    'title="Chandigarh, Canada">\n                                Chandigarh, Canada')
  assert.notEqual(changed, detailHTML)
  assert.throws(() => parseBaswareDetail(changed, row))
})

test('Basware preserves caller cancellation during the default transport handoff GET', async () => {
  const controller = new AbortController()
  const reason = Object.freeze(new Error('caller cancelled an in-flight Basware GET'))
  await assert.rejects(createBaswareScraper().run({ signal: controller.signal,
    fetchImpl: async (_url, { signal }) => { controller.abort(reason); signal.throwIfAborted() },
  }), error => error === reason)
})
