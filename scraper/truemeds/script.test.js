import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createTruemedsScraper } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/${name}.json.gz`, import.meta.url))))
const official = fixture('official-about')
const company = fixture('native-exact-company')
const listing = fixture('native-jobs')
const details = fixture('native-details')
const replay = (mutate = r => r) => async url => {
  const original = [official, company, listing, ...details].find(r => r.url === url)
  assert.ok(original, `Unexpected request ${url}`)
  const r = mutate({...original})
  return response(r.body, url, r.status)
}
const response = (body, url = official.url, status = 200) => ({ url, status, text: async () => body })
const gap = error => {
  assert.equal(error.code, 'TRUEMEDS_COVERAGE_GAP')
  assert.equal(error.inventoryEvidence.status, 'coverage-gap')
  assert.equal(error.inventoryEvidence.listingComplete, false)
  assert.equal(error.inventoryEvidence.reportedTotal, null)
  assert.equal(error.sourceListingComplete, false)
  return true
}

test('official Truemeds handoff is checked live; inaccessible employer inventory is a coverage gap', async () => {
  const calls = []
  await assert.rejects(createTruemedsScraper().run({ fetchImpl: async url => {
    calls.push(url)
    return url === official.url ? response(official.body) : response('blocked', url, 403)
  } }), gap)
  assert.equal(calls[0], 'https://www.truemeds.in/about-us')
  assert.equal(calls[1], 'https://www.linkedin.com/company/truemeds-india')
})

test('wrong employer and hidden-only official binding never trigger an external fetch', async () => {
  for (const body of [official.body.replaceAll('Intellihealth Solutions Private Limited', 'Unrelated Company'),
    '<p>Intellihealth Solutions Private Limited India Truemeds</p><template><a href="https://www.linkedin.com/company/truemeds-india">LinkedIn</a></template>']) {
    let count = 0
    await assert.rejects(createTruemedsScraper().run({fetchImpl: async url => { count++; return response(body, url) }}), gap)
    assert.equal(count, 1)
  }
})

test('request and body stalls are bounded by one aggregate deadline', async () => {
  for (const fetchImpl of [() => new Promise(() => {}), async url => ({url, status: 200, text: () => new Promise(() => {})})]) {
    await assert.rejects(createTruemedsScraper().run({fetchImpl, timeoutMs: 15}), gap)
  }
})

test('pre-abort and in-flight caller cancellation preserve the exact caller reason', async () => {
  for (const stage of ['before', 'fetch', 'body']) {
    const c = new AbortController(), reason = {cancelled: stage}
    if (stage === 'before') c.abort(reason)
    const pending = createTruemedsScraper().run({signal: c.signal, fetchImpl: async url => {
      if (stage === 'fetch') { c.abort(reason); return new Promise(() => {}) }
      return {url, status: 200, text: () => { c.abort(reason); return new Promise(() => {}) }}
    }})
    await assert.rejects(pending, error => error === reason)
  }
})

test('HTTP failure, redirect, malformed and empty pages cannot certify zero jobs', async () => {
  for (const r of [response('', official.url), response('denied', official.url, 403), response(official.body, 'https://truemed.com/'), response('<html>captcha</html>')]) {
    await assert.rejects(createTruemedsScraper().run({fetchImpl: async () => r}), gap)
  }
})

test('current official employer See jobs handoff enumerates native role URLs before detail validation', async () => {
  const calls = []
  await assert.rejects(createTruemedsScraper().run({ fetchImpl: async url => {
    calls.push(url)
    if (url === official.url) return response(official.body, url)
    if (url.startsWith('https://www.linkedin.com/company/')) return response(company.body, url)
    if (url === listing.url) return response(listing.body, url)
    return response('blocked detail', url, 403)
  }}), gap)
  assert.equal(calls[2], listing.url)
  assert.equal(calls[3], 'https://in.linkedin.com/jobs/view/product-analyst-senior-product-analyst-at-truemeds-4456903153')
})

test('native replay recovers ten verified India jobs and retains three blocked detail gaps', async () => {
  const jobs = await createTruemedsScraper().run({fetchImpl:replay(), now:() => '2026-10-23T06:00:00Z'})
  assert.equal(jobs.length, 10)
  const analyst = jobs.find(j => j.id === '4456903153')
  assert.equal(analyst.title, 'Product Analyst / Senior Product Analyst')
  assert.equal(analyst.postedAt, '2026-10-20T11:23:24.000Z')
  assert.equal(analyst.validThrough, '2026-11-23T08:56:17.000Z')
  assert.match(analyst.sourceDescription, /Own analytics for assigned business or product domains/)
  assert.equal(jobs[0].nativeCollectionEvidence.detailGaps.length, 3)
  assert.ok(jobs.every(j => j.country === 'India' && j.lifecycleCleanupAllowed === false && j.sourceListingComplete === false))
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

const changePosting = (receipt, change) => {
  if (!receipt.url.endsWith('-4456903153')) return receipt
  receipt.body = receipt.body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (all, open, body, close) => {
    const p = JSON.parse(body)
    if (p['@type'] !== 'JobPosting') return all
    change(p)
    return open + JSON.stringify(p) + close
  })
  return receipt
}

test('foreign, unknown and conflicting countries never become India from company headquarters', async () => {
  for (const country of ['US', 'ZZ', undefined]) {
    const jobs = await createTruemedsScraper().run({fetchImpl:replay(r => changePosting(r, p => {p.jobLocation.address.addressCountry = country})), now:() => '2026-10-23'})
    assert.ok(!jobs.some(j => j.id === '4456903153'))
  }
})

test('expired, future and invalid publication dates are excluded without replacing them with scrape time', async () => {
  for (const change of [p => {p.validThrough = '2026-10-22T12:00:00Z'}, p => {p.datePosted = '2026-11-01T12:00:00Z'}, p => {p.datePosted = 'yesterday'}]) {
    const jobs = await createTruemedsScraper().run({fetchImpl:replay(r => changePosting(r, change)), now:() => '2026-10-23'})
    assert.ok(!jobs.some(j => j.id === '4456903153'))
  }
})

test('absent public publication remains null and absent or heading-only JD remains eligible partial', async () => {
  for (const description of ['', '<h2>Responsibilities</h2><strong>Requirements</strong>']) {
    const jobs = await createTruemedsScraper().run({fetchImpl:replay(r => {
      r = changePosting(r, p => {delete p.datePosted; p.description = description})
      if (r.url.endsWith('-4456903153')) r.body = r.body.replace(/(<div class="show-more-less-html__markup[^>]*>)[\s\S]*?(<\/div>)/, '$1' + description + '$2')
      return r
    }), now:() => '2026-10-23'})
    const job = jobs.find(j => j.id === '4456903153')
    assert.ok(job)
    assert.equal(job.postedAt, null)
    assert.equal(job.sourceDescription, null)
    assert.equal(job.sourceDetailStatus, 'missing-description')
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
})

test('swapped employer and conflicting visible/schema role descriptions create retained typed detail gaps', async () => {
  for (const change of [p => {p.hiringOrganization.sameAs = 'https://www.linkedin.com/company/truemed'}, p => {p.description = '<p>Different job narrative</p>'}]) {
    const jobs = await createTruemedsScraper().run({fetchImpl:replay(r => changePosting(r, change)), now:() => '2026-10-23'})
    assert.ok(!jobs.some(j => j.id === '4456903153'))
    assert.ok(jobs[0].nativeCollectionEvidence.detailGaps.some(g => g.id === '4456903153' && g.code === 'TRUEMEDS_COVERAGE_GAP'))
  }
})

test('listing count and pagination drift are typed coverage gaps, never success-empty', async () => {
  await assert.rejects(createTruemedsScraper().run({fetchImpl:replay(r => {
    if (r.url === listing.url) r.body = r.body.replaceAll('viewed all jobs for this search', 'more jobs remain')
    return r
  })}), gap)
})

test('visible country conflicts with schema are quarantined even when schema says India', async () => {
  const jobs = await createTruemedsScraper().run({fetchImpl:replay(r => {
    if (r.url.endsWith('-4456903153')) r.body = r.body.replaceAll('Bengaluru, Karnataka, India', 'Bengaluru, Karnataka, Canada')
    return r
  }), now:() => '2026-10-23'})
  assert.ok(!jobs.some(j => j.id === '4456903153'))
})

test('country-valued regions that conflict with India are retained as typed detail gaps', async () => {
  for (const region of ['Canada', 'Ontario, Canada', 'United Kingdom']) {
    const jobs = await createTruemedsScraper().run({fetchImpl:replay(r => changePosting(r, p => {p.jobLocation.address.addressRegion = region})), now:() => '2026-10-23'})
    assert.ok(!jobs.some(j => j.id === '4456903153'))
    assert.ok(jobs[0].nativeCollectionEvidence.detailGaps.some(g => g.id === '4456903153' && g.code === 'TRUEMEDS_COVERAGE_GAP'))
  }
})

test('content-visibility hidden descriptions and inherited hidden descriptions remain eligible with null JD', async () => {
  for (const hiddenAt of ['description', 'ancestor']) {
    const jobs = await createTruemedsScraper().run({fetchImpl:replay(r => {
      if (r.url.endsWith('-4456903153')) {
        const pattern = hiddenAt === 'description' ? '<div class="show-more-less-html__markup' : '<section class="show-more-less-html'
        assert.ok(r.body.includes(pattern))
        r.body = r.body.replace(pattern, pattern.replace(' class=', ' style="content-visibility: hidden !important" class='))
      }
      return r
    }), now:() => '2026-10-23'})
    const job = jobs.find(j => j.id === '4456903153')
    assert.ok(job)
    assert.equal(job.postedAt, '2026-10-20T11:23:24.000Z')
    assert.equal(job.sourceDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceDetailStatus, 'missing-description')
  }
})
