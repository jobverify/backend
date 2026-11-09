import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { run } from '../../scraper/techmahindra/script.js'
import { parseNativeListing } from '../../scraper/techmahindra/nativeInventory.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/techMahindra/native-20261026/${name}.html`, import.meta.url), 'utf8')
const response = (html, url) => ({ html, status: 200, url, headers: new Headers() })
const listingUrl = 'https://careers.techmahindra.com/CurrentOpportunity.aspx'
const bpsUrl = 'https://careers.techmahindra.com/BpsOpportunity.aspx'
const selectedBps = () => fixture('bps').replace('selected="selected" value="Select country"', 'value="Select country"').replace('value="IND"', 'selected="selected" value="IND"')
const emptyScope = scope => scope === 'BPS' ? fixture('bps') : fixture('bps')
  .replaceAll('BpsOpportunity.aspx', 'CurrentOpportunity.aspx')
  .replaceAll('BPSOpportunity.aspx', 'CurrentOpportunity.aspx')
  .replace('Latest BPS Jobs', 'Latest IT Jobs')
  .replace('No jobs available for BPS', 'No jobs available')
const guardNetwork = async fn => {
  const original = globalThis.fetch
  globalThis.fetch = async () => { throw new Error('Fixture run attempted implicit network') }
  try { return await fn() } finally { globalThis.fetch = original }
}

test('current numeric Tech Mahindra cards enumerate via injected read-only search and never submit Apply/Shortlist', async () => {
  const calls = []
  const jobs = await guardNetwork(() => run({ maxPages: 1, fetchPage: async (url, init = {}) => {
    calls.push({ url, init })
    if (url === bpsUrl) return response(init.method === 'POST' ? selectedBps() : fixture('bps'), url)
    assert.equal(url, listingUrl)
    if (init.method === 'POST') {
      const form = new URLSearchParams(init.body)
      assert.equal(form.get('ctl00$ContentPlaceHolder1$ddlCountry'), 'IND')
      assert.equal(form.get('ctl00$ContentPlaceHolder1$ddlTotExpYears'), '0')
      assert.ok(![...form.keys()].some(key => /btn_jobs|btnApply/i.test(key)))
      return response(fixture('india-search'), url)
    }
    return response(fixture('initial'), url)
  } }))
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /public-detail-route-unavailable/)
  const audit = jobs[Symbol.for('jobverify.techmahindra-native-audit')]
  assert.equal(audit.scopes.IT.discovered.length, 12)
  assert.equal(audit.scopes.IT.discovered[0].nativeJobCode, '91763')
  assert.equal(audit.scopes.IT.discovered[0].title, 'IT Infrastructure Program Manager')
  assert.equal(audit.scopes.IT.discovered[0].country, null)
  assert.equal(audit.scopes.BPS.explicitEmpty, true)
  assert.equal(audit.scopes.IT.paginationComplete, false)
  assert.equal(calls.filter(call => call.init.method === 'POST').length, 1)
  assert.ok(calls.filter(call => call.url === bpsUrl).every(call => !call.init.method || call.init.method === 'GET'))
})

test('an explicitly supplied unusable Tech Mahindra transport never falls back to global fetch', async () => {
  await guardNetwork(() => assert.rejects(run({ transport: {} }), /invalid supplied transport/))
})

test('caller cancellation reaches injected Tech Mahindra transport before any public request', async () => {
  const controller = new AbortController()
  controller.abort(new Error('cancel Tech Mahindra fixture run'))
  let calls = 0
  await guardNetwork(() => assert.rejects(run({ signal: controller.signal, fetchPage: async () => { calls++; throw new Error('unreachable') } }), /cancel Tech Mahindra/))
  assert.equal(calls, 0)
})

test('current native pager changes targets while keeping exact sequential ordinals', () => {
  const first = parseNativeListing(fixture('india-search'), listingUrl, 'IT')
  const second = parseNativeListing(fixture('india-page2'), listingUrl, 'IT')
  assert.equal(first.page, 1)
  assert.equal(first.next.target, 'ctl00$ContentPlaceHolder1$rptPager$ctl01$lnkPage')
  assert.equal(second.page, 2)
  assert.equal(second.next.target, 'ctl00$ContentPlaceHolder1$rptPager$ctl04$lnkPage')
  assert.equal(second.cards.length, 12)
  assert.equal(second.cards[0].nativeJobCode, '96326')
})

test('registered Tech Mahindra runtime preserves transport options and incomplete current inventory evidence', async () => {
  const provider = getScraperCatalog().find(provider => provider.source === 'techmahindra')
  let audit
  const jobs = await guardNetwork(() => createCatalogScraper(provider).run({ maxPages: 5, maxJobs: 1, onNativeAudit: value => { audit = value }, fetchPage: async (url, init = {}) => {
    if (url === bpsUrl) return response(fixture('bps'), url)
    if (init.method !== 'POST') return response(fixture('initial'), url)
    const fields = new URLSearchParams(init.body)
    const target = fields.get('__EVENTTARGET')
    if (!target) return response(fixture('india-search'), url)
    if (target === 'ctl00$ContentPlaceHolder1$rptPager$ctl01$lnkPage') return response(fixture('india-page2'), url)
    return response(fixture('india-last'), url)
  } }))
  assert.equal(jobs.length, 0)
  assert.equal(audit.scopes.IT.discovered.length, 24)
  assert.equal(audit.scopes.IT.paginationComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /pager skipped or repeated a page/)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
})

test('a retained India dropdown and familiar cities never supply role country or a native publication date', async () => {
  const jobs = await guardNetwork(() => run({ maxPages: 1, fetchPage: async (url, init = {}) => response(url === bpsUrl ? fixture('bps') : fixture(init.method === 'POST' ? 'india-search' : 'initial'), url) }))
  const roles = jobs[Symbol.for('jobverify.techmahindra-native-audit')].scopes.IT.discovered
  assert.ok(roles.some(role => /PUNE|MUMBAI|BENGALURU/i.test(role.location)))
  assert.ok(roles.every(role => role.country === null && role.postedAt == null && role.jobDescription == null && role.requisitionId == null))
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('unbranded, hidden, inert, framed or redirected surfaces cannot certify empty Tech Mahindra inventory', async () => {
  const cases = [
    { mutate: html => html.replace('Careers & Job Opportunities with Tech Mahindra', 'Other Employer'), reason: /employer identity missing/ },
    { mutate: html => html.replace('<form name="aspnetForm"', '<form hidden name="aspnetForm"'), reason: /listing scope missing|one public ASP.NET form required/ },
    { mutate: html => html.replace('<form name="aspnetForm"', '<template><form name="aspnetForm"'), reason: /listing scope missing|one public ASP.NET form required/ },
    { mutate: html => html.replace('</form>', '<iframe src="https://other.example/jobs"></iframe></form>'), reason: /additional-active-frame/ },
  ]
  for (const scenario of cases) {
    const jobs = await guardNetwork(() => run({ maxPages: 1, fetchPage: async (url, init = {}) => response(scenario.mutate(url === bpsUrl ? fixture('bps') : fixture(init.method === 'POST' ? 'india-search' : 'initial')), url) }))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.match(readInventoryEvidence(jobs).reason, scenario.reason)
  }
  const jobs = await guardNetwork(() => run({ fetchPage: async () => ({ status: 302, url: listingUrl, html: 'Object moved', headers: new Headers({location:'/Signin.aspx'}) }) }))
  assert.match(readInventoryEvidence(jobs).reason, /HTTP 302/)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  const redirected = jobs[Symbol.for('jobverify.techmahindra-native-audit')].responses
  assert.equal(redirected.length, 2)
  assert.ok(redirected.every(response => response.status === 302 && response.location === '/Signin.aspx'))
})

test('closing traversal detects a later native page change even when the first page stays stable', async () => {
  let searches = 0
  // A controlled two-page variant of captured native page two keeps its real
  // controls and role data while removing only forward pagination targets.
  const terminalSecond = fixture('india-page2').replace(/<a\b[^>]*class="page_enabled"[^>]*>(?:3|4|5|>>|Last)<\/a>/g, '')
  const jobs = await guardNetwork(() => run({ fetchPage: async (url, init = {}) => {
    if (url === bpsUrl) return response(fixture('bps'), url)
    if (init.method !== 'POST') return response(fixture('initial'), url)
    const fields = new URLSearchParams(init.body)
    if (!fields.get('__EVENTTARGET')) { searches++; return response(fixture('india-search'), url) }
    return response(searches > 1 ? terminalSecond.replace('value="96326"', 'value="99999"') : terminalSecond, url)
  } }))
  const audit = jobs[Symbol.for('jobverify.techmahindra-native-audit')]
  assert.equal(audit.scopes.IT.discovered.length, 24)
  assert.equal(audit.scopes.IT.paginationComplete, true)
  assert.equal(audit.scopes.IT.closingStable, false)
  assert.match(readInventoryEvidence(jobs).reason, /closing-inventory-changed/)
})

test('native closing reconciliation compares role identity and content independently of presentation order', async () => {
  let searches = 0
  const terminalSecond = fixture('india-page2').replace(/<a\b[^>]*class="page_enabled"[^>]*>(?:3|4|5|>>|Last)<\/a>/g, '')
  const cells = [...terminalSecond.matchAll(/<td>[\s\S]*?<\/td>/g)].map(match => match[0])
  const reordered = terminalSecond.replace(cells[0], 'NATIVE-FIXTURE-SWAP').replace(cells[1], cells[0]).replace('NATIVE-FIXTURE-SWAP', cells[1])
  const jobs = await guardNetwork(() => run({ fetchPage: async (url, init = {}) => {
    if (url === bpsUrl) return response(fixture('bps'), url)
    if (init.method !== 'POST') return response(fixture('initial'), url)
    if (!new URLSearchParams(init.body).get('__EVENTTARGET')) { searches++; return response(fixture('india-search'), url) }
    return response(searches > 1 ? reordered : terminalSecond, url)
  } }))
  assert.equal(jobs[Symbol.for('jobverify.techmahindra-native-audit')].scopes.IT.closingStable, true)
  assert.doesNotMatch(readInventoryEvidence(jobs).reason, /closing-inventory-changed/)
})

test('bare native empty content is partial even when the country filter and employer shell remain', async () => {
  const bare = fixture('bps').replace('No jobs available for BPS', '')
  const jobs = await guardNetwork(() => run({ maxPages: 1, fetchPage: async url => response(url === bpsUrl ? bare : fixture('initial').replace(/<table id="ctl00_ContentPlaceHolder1_DataListRecommended"[\s\S]*?<\/table>/, ''), url) }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
})

test('native pagination carries fresh ASP.NET state and the anonymous session without role submit controls', async () => {
  let paged = false
  const jobs = await guardNetwork(() => run({ maxPages: 2, fetchPage: async (url, init = {}) => {
    if (url === bpsUrl) return response(fixture('bps'), url)
    if (init.method !== 'POST') return { ...response(fixture('initial').replaceAll('SANITIZED-PUBLIC-STATE', 'initial-fixture-state'), url), headers: new Headers({ 'Set-Cookie': 'nativeFixtureSession=anonymous; Secure; HttpOnly' }) }
    assert.match(init.headers.Cookie, /nativeFixtureSession=anonymous/)
    const fields = new URLSearchParams(init.body)
    assert.ok(![...fields.keys()].some(key => /\$(?:btn_jobs|btnApply)$/.test(key)))
    if (!fields.get('__EVENTTARGET')) {
      assert.equal(fields.get('__VIEWSTATE'), 'initial-fixture-state')
      return response(fixture('india-search').replaceAll('SANITIZED-PUBLIC-STATE', 'refreshed-fixture-state'), url)
    }
    paged = true
    assert.equal(fields.get('__VIEWSTATE'), 'refreshed-fixture-state')
    assert.equal(fields.get('ctl00$ContentPlaceHolder1$ddlCountry'), 'IND')
    assert.equal(fields.get('ctl00$ContentPlaceHolder1$ddlMinExp'), '0')
    assert.equal(fields.get('ctl00$ContentPlaceHolder1$ddlCity'), '0')
    return response(fixture('india-page2'), url)
  } }))
  assert.equal(paged, true)
  assert.equal(jobs[Symbol.for('jobverify.techmahindra-native-audit')].scopes.IT.discovered.length, 24)
})

test('only unfiltered native empty snapshots for both Tech Mahindra scopes certify absence', async () => {
  let requests = 0
  const jobs = await guardNetwork(() => run({ fetchPage: async (url, init = {}) => {
    requests++
    assert.notEqual(init.method, 'POST')
    return response(emptyScope(url === bpsUrl ? 'BPS' : 'IT'), url)
  } }))
  assert.equal(requests, 4)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('a Canada-selected native empty message cannot certify Tech Mahindra India absence', async () => {
  const canada = html => html.replace('selected="selected" value="Select country"', 'value="Select country"').replace('value="CAN"', 'selected="selected" value="CAN"')
  const jobs = await guardNetwork(() => run({ fetchPage: async url => response(canada(emptyScope(url === bpsUrl ? 'BPS' : 'IT')), url) }))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.notEqual(evidence.status, 'verified-empty')
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /restricted-empty-scope/)
})

test('an additional active Workday link keeps both empty native scopes incomplete', async () => {
  const jobs = await guardNetwork(() => run({ fetchPage: async url => response(emptyScope(url === bpsUrl ? 'BPS' : 'IT').replace('</form>', '<a href="https://techmahindra.wd5.myworkdayjobs.com/External">Careers</a></form>'), url) }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.notEqual(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.match(readInventoryEvidence(jobs).reason, /additional-ATS-scope/)
})

test('additional active ATS script declarations keep native emptiness partial without requesting the ATS', async () => {
  for (const script of [
    '<script src="https://techmahindra.wd5.myworkdayjobs.com/External/jobs.js"></script>',
    '<script>window.careersBoard="https://techmahindra.wd5.myworkdayjobs.com/External";</script>',
    '<script>window.careersBoard="https:\\/\\/techmahindra.wd5.myworkdayjobs.com\\/External";</script>',
  ]) {
    const jobs = await guardNetwork(() => run({ fetchPage: async url => {
      assert.ok(url === listingUrl || url === bpsUrl)
      return response(emptyScope(url === bpsUrl ? 'BPS' : 'IT').replace('</form>', `${script}</form>`), url)
    } }))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.match(readInventoryEvidence(jobs).reason, /additional-ATS-scope/)
  }
})

test('an ATS link added only during a closing empty read invalidates Tech Mahindra absence', async () => {
  const reads = new Map()
  const jobs = await guardNetwork(() => run({ fetchPage: async url => {
    const count = (reads.get(url) || 0) + 1
    reads.set(url, count)
    const html = emptyScope(url === bpsUrl ? 'BPS' : 'IT')
    return response(count > 1 ? html.replace('</form>', '<a href="https://techmahindra.wd5.myworkdayjobs.com/External">Careers</a></form>') : html, url)
  } }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /additional-ATS-scope/)
})

test('native empty scope validation includes text, experience, designation and closing selections', async () => {
  const restrictors = [
    html => html.replace('name="ctl00$ContentPlaceHolder1$txtSkill" type="text"', 'name="ctl00$ContentPlaceHolder1$txtSkill" value="Java" type="text"'),
    html => html.replace('selected="selected" value="NA"', 'value="NA"').replace('value="5">5', 'selected="selected" value="5">5'),
    html => html.replace('selected="selected" value="Select designation"', 'value="Select designation"').replace('value="Trainer-BPS"', 'selected="selected" value="Trainer-BPS"'),
  ]
  for (const restrict of restrictors) {
    const jobs = await guardNetwork(() => run({ fetchPage: async url => response(restrict(emptyScope(url === bpsUrl ? 'BPS' : 'IT')), url) }))
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.match(readInventoryEvidence(jobs).reason, /restricted-empty-scope/)
  }
  const reads = new Map()
  const jobs = await guardNetwork(() => run({ fetchPage: async url => {
    const count = (reads.get(url) || 0) + 1
    reads.set(url, count)
    const html = emptyScope(url === bpsUrl ? 'BPS' : 'IT')
    return response(count > 1 ? html.replace('selected="selected" value="Select country"', 'value="Select country"').replace('value="CAN"', 'selected="selected" value="CAN"') : html, url)
  } }))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /restricted-empty-scope/)
})

test('inert ATS declarations cannot add an active board to a native empty scope', async () => {
  const inert = '<template><a href="https://techmahindra.wd5.myworkdayjobs.com/External">Careers</a><script src="https://techmahindra.wd5.myworkdayjobs.com/External/jobs.js"></script></template>'
  const jobs = await guardNetwork(() => run({ fetchPage: async url => response(emptyScope(url === bpsUrl ? 'BPS' : 'IT').replace('</form>', `${inert}</form>`), url) }))
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('a native public detail link outside parsed cards prevents Tech Mahindra empty proof', async () => {
  const roleLink = '<a href="https://careers.techmahindra.com/JobDetails.aspx?JobCode=91763&amp;IndustryType=IT">View role</a>'
  const jobs = await guardNetwork(() => run({ fetchPage: async url => response(emptyScope(url === bpsUrl ? 'BPS' : 'IT').replace('</form>', `${roleLink}</form>`), url) }))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.notEqual(evidence.status, 'verified-empty')
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /additional-ATS-scope/)
  const audit = jobs[Symbol.for('jobverify.techmahindra-native-audit')]
  assert.deepEqual(audit.scopes.IT.additionalScopes, ['https://careers.techmahindra.com/JobDetails.aspx?JobCode=91763&IndustryType=IT'])
})

test('an out-of-card native detail link added only during closing invalidates absence', async () => {
  const reads = new Map()
  const jobs = await guardNetwork(() => run({ fetchPage: async url => {
    const count = (reads.get(url) || 0) + 1
    reads.set(url, count)
    const html = emptyScope(url === bpsUrl ? 'BPS' : 'IT')
    return response(count > 1 ? html.replace('</form>', '<a href="https://careers.techmahindra.com/JobDetails.aspx?JobCode=91763&amp;IndustryType=IT">View role</a></form>') : html, url)
  } }))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.notEqual(evidence.status, 'verified-empty')
  assert.match(evidence.reason, /additional-ATS-scope/)
})

test('only native detail URLs attached to parsed cards are reconciled with the listing', () => {
  const declared = '<a href="https://careers.techmahindra.com/JobDetails.aspx?JobCode=91763&amp;IndustryType=IT">View role</a>'
  const html = fixture('india-search').replace(/<input\b[^>]*name="ctl00\$ContentPlaceHolder1\$DataListRecommended\$ctl00\$btn_jobs"[^>]*>/, declared)
  const page = parseNativeListing(html, listingUrl, 'IT')
  assert.equal(page.cards.length, 12)
  assert.equal(page.cards[0].sourceUrl, 'https://careers.techmahindra.com/JobDetails.aspx?JobCode=91763&IndustryType=IT')
  assert.deepEqual(page.additionalScopes, [])
  const withUnparsed = parseNativeListing(html.replace('</form>', '<a href="JobDetails.aspx?JobCode=99999&amp;IndustryType=IT">View another role</a></form>'), listingUrl, 'IT')
  assert.deepEqual(withUnparsed.additionalScopes, ['https://careers.techmahindra.com/JobDetails.aspx?JobCode=99999&IndustryType=IT'])
})
