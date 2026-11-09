import assert from 'node:assert/strict'
import test from 'node:test'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import * as progress from '../../scraper/progresssoftware/script.js'
const fixture = name => JSON.parse(gunzipSync(readFileSync(new URL(`../../scraper/progresssoftware/fixtures/${name}.json.gz`, import.meta.url))))
const captures = [fixture('careers-response'), fixture('listing-response'), ...fixture('detail-responses')]
const fetchFixture = async url => {
  const capture = captures.find(row => row.url === url)
  assert.ok(capture, 'Unexpected source URL ' + url)
  return capture.body
}

test('Progress Software reconciles all native cards, structured URLs and country facet counts', () => {
  const inventory = progress.parseNativeListing(fixture('listing-response').body)
  assert.equal(inventory.records.length, 26)
  assert.equal(inventory.indiaCount, 10)
  const multi = inventory.records.find(row => row.title.startsWith('Workday HRIS'))
  assert.equal(multi.country, 'India')
  assert.deepEqual(multi.locations, ['Bengaluru, India', 'Hyderabad, India'])
})

test('Progress Software fetches and verifies current native details, preserving publication and secondary India locations', async () => {
  const jobs = await progress.run({ fetchText: fetchFixture })
  assert.equal(jobs.length, 10)
  const multi = jobs.find(job => job.jobId === 'o1cQAfwn')
  assert.deepEqual(multi.locations, ['Bengaluru, India', 'Hyderabad, India'])
  assert.equal(multi.postingDate, '2026-10-22')
  assert.match(multi.jobDescription, /Workday/)
  const rust = jobs.find(job => job.jobId === 'ogKzAfwT')
  assert.equal(rust.postingDate, '2026-08-26')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 26)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 10)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Progress Software rejects missing cards, changed counts and contradictory native countries', () => {
  const html = fixture('listing-response').body
  for (const changed of [html.replace('data-count="10"', 'data-count="11"'),
    html.replace('<li country="India"', '<li country="Canada"'),
    html.replace('class="job-listing Elevated', 'class="other Elevated'),
    html.replaceAll('/careers/open-positions/workday-', '/careers/open-positions/../outside/workday-'),
    html.replace('</body>', ''),
  ]) assert.throws(() => progress.parseNativeListing(changed), /Progress|unclosed/)
})

test('Progress Software rejects a new homepage openings handoff even while an old link remains', async () => {
  const home = fixture('careers-response')
  const html = home.body.replace('href="/company/careers/open-positions"', 'href="https://careers.other.example/progress"')
  await assert.rejects(progress.run({ fetchText: async url => url === home.url ? html : fetchFixture(url) }), /Progress.*handoff/)
})

test('Progress Software retains schema-only or heading-only descriptions as missing visible detail', async () => {
  const selected = captures.find(row => row.url.includes('workday-'))
  for (const inner of ['', '<h3>Requirements</h3><p>&nbsp;</p>']) {
    let html = selected.body.replace(/<h2>Job Summary<\/h2>[\s\S]*?(?=<input id="jobId")/, `<h2>Job Summary</h2><div>${inner}</div>`)
    if (inner) html = html.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (match, open, raw, close) => {
      const value = JSON.parse(raw)
      return value['@type'] === 'JobPosting' ? open + JSON.stringify({ ...value, description: '' }) + close : match
    })
    const jobs = await progress.run({ fetchText: async url => url === selected.url ? html : fetchFixture(url) })
    const job = jobs.find(job => job.jobId === 'o1cQAfwn')
    assert.equal(jobs.length, 10)
    assert.equal(job.jobDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  }
})

test('Progress Software rejects visibly unavailable roles despite retained valid structured data', () => {
  const row = progress.parseNativeListing(fixture('listing-response').body).records.find(row => row.jobId === 'o1cQAfwn')
  const capture = captures.find(item => item.url === row.detailUrl)
  for (const message of ['This job is no longer available', 'This position is no longer active', 'This position has been filled']) {
    const html = capture.body.replace('</body>', `<div role="alert">${message}</div></body>`)
    assert.throws(() => progress.parseNativeDetail(html, row), /Progress.*closed/)
  }
  const inert = capture.body.replace('</body>', '<template>This job is no longer available</template><div hidden>This position has been filled</div></body>')
  assert.equal(progress.parseNativeDetail(inert, row).jobId, row.jobId)
})

test('Progress Software keeps valid native offset publication dates and rejects impossible dates or identities', () => {
  const row = progress.parseNativeListing(fixture('listing-response').body).records.find(row => row.jobId === 'o1cQAfwn')
  const capture = captures.find(item => item.url === row.detailUrl)
  const mutateSchema = changes => capture.body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (match, open, raw, close) => {
    const data = JSON.parse(raw)
    return data['@type'] === 'JobPosting' ? open + JSON.stringify({ ...data, ...changes }) + close : match
  })
  assert.equal(progress.parseNativeDetail(mutateSchema({ datePosted: '2026-10-22T14:20:00+05:30' }), row).postingDate, '2026-10-22T14:20:00+05:30')
  for (const html of [mutateSchema({ datePosted: '2026-02-31T14:20:00+05:30' }),
    mutateSchema({ hiringOrganization: { name: 'Other' } }),
    mutateSchema({ jobLocation: { address: { addressLocality: 'Bengaluru', addressCountry: 'Canada' } } }),
    capture.body.replace("value='o1cQAfwn'", "value='o1cqafwn'"),
  ]) assert.throws(() => progress.parseNativeDetail(html, row), /Progress/)
})

const loadModule = async () => {
  try {
    return await import('../../scraper/progresssoftware/script.js')
  } catch {
    assert.fail('Expected Progress Software scraper module at ../../scraper/progresssoftware/script.js')
  }
}

test('Progress Software preserves its verified first-party metadata', async () => {
  const progressSoftware = await loadModule()

  assert.equal(progressSoftware.SOURCE, 'progresssoftware')
  assert.equal(progressSoftware.COMPANY_NAME, 'Progress Software')
  assert.equal(progressSoftware.CAREERS_HOME_URL, 'https://www.progress.com/company/careers')
  assert.equal(progressSoftware.OPEN_POSITIONS_URL, 'https://www.progress.com/company/careers/open-positions')
  assert.equal(
    progressSoftware.JOB_PAGE_PREFIX,
    'https://www.progress.com/company/careers/open-positions/',
  )
})

test('Progress Software rejects changed official surfaces instead of reporting unobserved zero', async () => {
  const progressSoftware = await loadModule()
  let fetchCalls = 0

  await assert.rejects(progressSoftware.createProgressSoftwareScraper().run({
    fetchText: async () => {
      fetchCalls += 1
      return '<html><body>unexpected public jobs surface</body></html>'
    },
  }))
  assert.equal(fetchCalls, 1)
})

test('Progress Software propagates an official request failure', async () => {
  const progressSoftware = await loadModule()
  let fetchCalls = 0

  await assert.rejects(progressSoftware.run({
    fetchText: async () => {
      fetchCalls += 1
      throw new Error('official source unavailable')
    },
  }), /official source unavailable/)
  assert.equal(fetchCalls, 1)
})

test('Progress Software bounds noncooperative requests and honours active cancellation', async () => {
  const moduleUrl = new URL('../../scraper/progresssoftware/script.js', import.meta.url).href
  const script = `
    import { run } from ${JSON.stringify(moduleUrl)};
    process.send('ready');
    const keepAlive = setInterval(() => {}, 100);
    const results = [];
    try {
      for (const mode of ['deadline', 'abort', 'body']) {
        const controller = new AbortController();
        const timer = mode === 'abort' ? setTimeout(() => controller.abort(new Error('caller cancelled')), 10) : null;
        globalThis.fetch = async url => ({ status: 200, url, text: () => new Promise(() => {}) });
        try { await run({ signal: controller.signal, timeoutMs: mode === 'abort' ? 1000 : 10,
          ...(mode === 'body' ? {} : { fetchText: () => new Promise(() => {}) }) }); results.push('unexpected success'); }
        catch(error) { results.push(error.message); }
        finally { clearTimeout(timer); }
      }
      console.log(JSON.stringify(results));
    } finally { clearInterval(keepAlive); }
  `
  const output = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'], windowsHide: true,
    })
    let stdout = '', stderr = '', ready = false, deadlineError
    const expire = phase => {
      deadlineError = new Error(`Progress Software ${phase} deadline exceeded`)
      child.kill()
    }
    // Imports have a separate bound so process startup under suite load cannot
    // consume the original two-second transport/cancellation watchdog.
    let timer = setTimeout(() => expire('child startup'), 30000)
    child.stdout.setEncoding('utf8').on('data', data => { stdout += data })
    child.stderr.setEncoding('utf8').on('data', data => { stderr += data })
    child.on('message', message => {
      if (message !== 'ready' || ready) return
      ready = true
      clearTimeout(timer)
      timer = setTimeout(() => expire('transport checks'), 2000)
    })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (deadlineError) reject(deadlineError)
      else if (!ready || code !== 0) reject(new Error(`Progress Software child failed (${code ?? signal}): ${stderr}`))
      else resolve(stdout)
    })
  })
  const results = JSON.parse(output)
  assert.match(results[0], /deadline|timed out|timeout/i)
  assert.match(results[1], /caller cancelled/)
  assert.match(results[2], /deadline|timed out|timeout/i)
})

test('Progress Software import with a parent dry-run flag neither fetches nor writes', () => {
  const moduleUrl = new URL('../../scraper/progresssoftware/script.js', import.meta.url).href
  const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import fs from 'node:fs';
    fs.writeFileSync = () => { throw new Error('Unexpected import write'); };
    globalThis.fetch = () => { throw new Error('Unexpected import fetch'); };
    process.argv.push('--dry-run'); await import(${JSON.stringify(moduleUrl)}); console.log('imported');
  `], { encoding: 'utf8', timeout: 5000 })
  assert.equal(result.trim(), 'imported')
})
