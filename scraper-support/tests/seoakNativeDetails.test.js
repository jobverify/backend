import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, CAREERS_URL } from '../../scraper/seoak/script.js'

const fixture = name => gunzipSync(readFileSync(new URL(`./fixtures/seoak/${name}.gz`, import.meta.url))).toString()
const html = fixture('careers.html')
const javascript = fixture('careers.js')
const assetUrl = 'https://www.seoak.in/_next/static/chunks/app/careers/page-9ab6b10b31518811.js'
const replay = (body = javascript, overrides = {}) => run({
  fetchText: async url => { assert.equal(url, CAREERS_URL); return html },
  fetchAsset: async url => { assert.equal(url, assetUrl); return { status: 200, url, html: body } },
  now: () => '2026-10-29T17:18:00.000Z',
  ...overrides,
})

test('SEOAK recovers the exact active Sales Manager modal and keeps Executive identity conflict explicit', async () => {
  const jobs = await replay()
  const sales = jobs.find(job => job.title === 'Sales Manager')
  assert.equal(sales.sourceDetailComplete, true)
  assert.match(sales.sourceDescription, /^Role: Sales Manager\n/)
  assert.match(sales.sourceDescription, /Analyze market trends to identify potential sales opportunities/)
  assert.match(sales.sourceDescription, /Proven experience in sales management or business development/)
  assert.match(sales.sourceDescription, /Strong problem-solving skills and a customer-oriented approach/)
  assert.doesNotMatch(sales.sourceDescription, /Research the market to find out what can be sold|Apply Now|Discover Career/)
  assert.equal(sales.jobDescription, sales.sourceDescription)
  assert.equal(sales.sourceDetailVerifiedAt, '2026-10-29T17:18:00.000Z')
  const executive = jobs.find(job => job.title === 'Business Development Executive')
  assert.equal(executive.sourceDescription, null)
  assert.equal(executive.sourceDetailComplete, false)
  assert.equal(executive.sourceDetailFailureKind, 'source-detail-title-mismatch')
})

test('SEOAK follows modal id binding rather than borrowing a same-title unused component', async () => {
  const jobs = await replay(javascript.replace('children:(0,n.jsx)(o,{})', 'children:(0,n.jsx)(l,{})'))
  assert.ok(jobs.every(job => !job.sourceDetailComplete && job.sourceDescription === null))
})

test('SEOAK rejects broken active-card linkage and nonliteral description children', async () => {
  for (const changed of [
    javascript.replace('t(null==s?void 0:s.id)', 't(2)'),
    javascript.replace('children:null==s?void 0:s.role', 'children:null==s?void 0:s.type'),
    javascript.replace('i.map((e,s)=>(0,n.jsx)(d,{data:e,setJobClicked:c},s))', 'i.map((e,s)=>(0,n.jsx)(d,{data:e,setJobClicked:s},s))'),
    javascript.replace('children:"• Strong communication and negotiation skills."', 'children:loadDescription()'),
    javascript.replace('role:"Sales Manager"', 'role:"Sales Executive"'),
  ]) {
    const jobs = await replay(changed)
    assert.ok(jobs.every(job => !job.sourceDetailComplete && job.sourceDescription === null))
  }
})

test('SEOAK never executes downloaded code and rejects duplicate ambiguous modules', async () => {
  const safe = await replay('throw new Error("never execute");' + javascript)
  assert.equal(safe[1].sourceDetailComplete, true)
  const ambiguous = await replay(javascript + javascript)
  assert.ok(ambiguous.every(job => !job.sourceDetailComplete))
})

test('SEOAK keeps listing rows incomplete when the exact linked asset is unavailable or redirects', async () => {
  for (const fetchAsset of [
    async () => { throw new Error('network unavailable') },
    async () => ({ status: 403, url: assetUrl, html: javascript }),
    async () => ({ status: 200, url: 'https://foreign.example/page.js', html: javascript }),
    async () => ({ status: 200, url: assetUrl, html: 'broken javascript {' }),
  ]) {
    const jobs = await replay(javascript, { fetchAsset })
    assert.equal(jobs.length, 2)
    assert.ok(jobs.every(job => !job.sourceDetailComplete && job.sourceDescription === null && job.sourceDetailFailureKind))
  }
})

test('SEOAK fetches only one unambiguous same-origin careers page asset linked in verified HTML', async () => {
  for (const replacement of [
    'https://foreign.example/_next/static/chunks/app/careers/page-9ab6b10b31518811.js',
    '/_next/static/chunks/app/other/page-9ab6b10b31518811.js',
    '/_next/static/chunks/app/careers/page-9ab6b10b31518811.js?unverified=1',
  ]) {
    const jobs = await replay(javascript, {
      fetchText: async () => html.replace('/_next/static/chunks/app/careers/page-9ab6b10b31518811.js"', `${replacement}"`),
      fetchAsset: async () => assert.fail('must not fetch an unrelated asset'),
    })
    assert.ok(jobs.every(job => !job.sourceDetailComplete))
  }
  const ambiguous = await replay(javascript, {
    fetchText: async () => html + '<script src="/_next/static/chunks/app/careers/page-otherhash.js"></script>',
    fetchAsset: async () => assert.fail('must not choose between multiple careers page assets'),
  })
  assert.ok(ambiguous.every(job => !job.sourceDetailComplete))
})
