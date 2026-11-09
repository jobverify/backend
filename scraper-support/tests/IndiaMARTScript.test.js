import assert from 'node:assert/strict'
import test from 'node:test'
import { createBrowserNetworkFallback } from '../shared/browserNetworkFallback.js'
import { createBrowserFetchSession } from '../shared/browserFetch.js'

// Inert historical unit fixtures only. No retired source is imported or
// registered; these shared HTTP transport checks claim no Klimb job parsing.

const homepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>IndiaMART InterMESH Ltd</h1>
      <a href="field-sales-and-servicing.html">Field Sales</a>
      <a href="tele-sales-and-servicing.html">Tele Sales</a>
      <a href="leadership-product-tech-corporate-roles.html">Leadership</a>
      <a href="https://imerp.intermesh.net/im-job-application/auth/jobid/MjIx">Legacy Apply</a>
    </main>
  </body>
</html>
`

const leadershipHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Leadership / Product / Tech &amp; Corporate Roles</h1>
      <script src="https://joblist.klimb.io/js/embedscripts/embed.js"></script>
      <div id="klimbjobs"></div>
      <script>
        klimb_init({ company : "indiamart" })
      </script>
    </main>
  </body>
</html>
`

const boardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IndiaMART InterMESH Ltd. Careers</title>
  </head>
  <body>
    <main>
      <h1>Jobs at IndiaMART InterMESH Ltd.</h1>
      <input id="cusId" value="5dd7966c6c4d197f68105048">
      <script>
        getFilterContent('5dd7966c6c4d197f68105048','indiamart','true','careers')
      </script>
      <div
        data-template-department="Engineering"
        data-template-locaName="Bengaluru"
        onclick="redirectToPage('/indiamart/role-1?source=careers')"
      >
        <div class="role-new role">Platform Engineer</div>
        <ul>
          <li class="info list-inline-item">Engineering</li>
          <li class="info list-inline-item">4-6 years</li>
        </ul>
        <div class="current-opening-desc">Design internal platform systems.</div>
      </div>
    </main>
  </body>
</html>
`

const boardHtmlWithCursor = boardHtml.replace(
  '</main>',
  `<script>loadMoreJobs('careers','cursor-1')</script></main>`,
)

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main data-position="role-1">
      <h1>Platform Engineer</h1>
      <p>IndiaMART InterMESH Ltd.</p>
      <a href="/indiamart/role-1/apply?source=careers">Apply</a>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Platform Engineer"}
      </script>
    </main>
  </body>
</html>
`

const CAREERS_HOMEPAGE_URL = 'https://careers.indiamart.com/'
const LEADERSHIP_JOBS_PAGE_URL = 'https://careers.indiamart.com/leadership-product-tech-corporate-roles.html'
const JOBS_BOARD_URL = 'https://joblist.klimb.io/indiamart'
const DETAIL_URL = 'https://joblist.klimb.io/indiamart/role-1?source=careers'
const PAGINATION_URL = `${JOBS_BOARD_URL}?lastPosId=cursor-1`
const historicalPages = new Map([
  [CAREERS_HOMEPAGE_URL, homepageHtml],
  [LEADERSHIP_JOBS_PAGE_URL, leadershipHtml],
  [JOBS_BOARD_URL, boardHtml],
  [DETAIL_URL, detailHtml],
])
const paginationPayload = {
        jobs: { positions: [] },
        showLoadMore: false,
      }

test('shared transport returns original historical HTML on Node success without invoking a fallback', async t => {
  const primaryUrls = []
  let alternateCalls = 0
  t.mock.method(globalThis, 'fetch', async () => assert.fail('A successful injected primary transport needs no compatibility HTTP request'))
  const fallback = createBrowserNetworkFallback({
    fetchText: async url => { primaryUrls.push(url); assert.ok(historicalPages.has(url)); return historicalPages.get(url) },
    fetchBrowserText: async () => { alternateCalls++; assert.fail('Node success must not invoke the alternate loader') },
  })
  try {
    for (const [url, html] of historicalPages) assert.equal(await fallback.fetchText(url), html)
    assert.deepEqual(primaryUrls, [...historicalPages.keys()])
    assert.equal(alternateCalls, 0)
  } finally { await fallback.close() }
})

test('shared Node-timeout fallback preserves all original historical HTML through an injected HTTP-only compatibility session', async t => {
  const primaryUrls = [], alternateUrls = [], httpUrls = []
  t.mock.method(globalThis, 'fetch', async url => {
    const target = String(url); httpUrls.push(target); assert.ok(historicalPages.has(target))
    return new Response(historicalPages.get(target), { status: 200, headers: { 'content-type': 'text/html' } })
  })
  const session = await createBrowserFetchSession()
  const fallback = createBrowserNetworkFallback({
    fetchText: async url => { primaryUrls.push(url); throw new TypeError('fetch failed | Connect Timeout Error') },
    fetchBrowserText: async (url, options) => { alternateUrls.push(url); return session.fetchText(url, options) },
  })
  try {
    for (const [url, html] of historicalPages) assert.equal(await fallback.fetchText(url), html)
    assert.deepEqual(primaryUrls, [...historicalPages.keys()])
    assert.deepEqual(alternateUrls, primaryUrls)
    assert.deepEqual(httpUrls, primaryUrls)
  } finally { await fallback.close(); await session.close() }
})

test('shared JSON-timeout fallback preserves the original historical pagination payload and explicit landing URL', async t => {
  const primaryJsonUrls = [], alternateJsonUrls = [], httpUrls = []
  t.mock.method(globalThis, 'fetch', async url => {
    const target = String(url); httpUrls.push(target)
    if (target === JOBS_BOARD_URL) return new Response(boardHtmlWithCursor, { status: 200, headers: { 'content-type': 'text/html' } })
    assert.equal(target, PAGINATION_URL)
    return new Response(JSON.stringify(paginationPayload), { status: 200, headers: { 'content-type': 'application/json' } })
  })
  const session = await createBrowserFetchSession()
  const fallback = createBrowserNetworkFallback({
    fetchJson: async url => { primaryJsonUrls.push(url); throw new TypeError('fetch failed | Connect Timeout Error') },
    fetchBrowserJson: async (url, options) => {
      alternateJsonUrls.push({ url, landingUrl: options.browserLandingUrl })
      return session.fetchJson(url, { ...options, landingUrl: options.browserLandingUrl })
    },
  })
  try {
    assert.deepEqual(await fallback.fetchJson(PAGINATION_URL, { browserLandingUrl: JOBS_BOARD_URL }), paginationPayload)
    assert.deepEqual(primaryJsonUrls, [PAGINATION_URL])
    assert.deepEqual(alternateJsonUrls, [{ url: PAGINATION_URL, landingUrl: JOBS_BOARD_URL }])
    assert.deepEqual(httpUrls, [JOBS_BOARD_URL, PAGINATION_URL])
  } finally { await fallback.close(); await session.close() }
})
