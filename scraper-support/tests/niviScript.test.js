import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Nivi: outcomes driven by insight</title>
    <meta
      name="description"
      content="Nivi is a messaging-first health platform delivering consumer insights, engagement innovation, and health outcomes at scale across emerging markets."
    />
    <meta name="author" content="Nivi Inc." />
    <script type="module" crossorigin src="/assets/index-tmZUd8-T.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const aboutBundleSnippet = `
function PN(){return u.jsxs(Ui,{children:[
  u.jsx("section",{children:u.jsxs("div",{children:[
    u.jsx("h2",{children:"Join Our Team"}),
    u.jsx("p",{children:"We're always looking for passionate people who want to make a difference in global health."}),
    u.jsx(dr,{asChild:!0,size:"lg",children:u.jsxs(qe,{to:"/careers",children:["View Open Positions",u.jsx(Uo,{className:"ml-2 h-5 w-5"})]})})
  ]})})
]})}
function _I(){return u.jsxs(Ui,{children:[
  u.jsx("section",{children:u.jsxs("div",{children:[
    u.jsx("h1",{children:"Careers at Nivi"}),
    u.jsx("p",{children:"Join us in our mission to improve health outcomes for the next billion consumers."}),
    u.jsx("h2",{children:"No Open Positions"}),
    u.jsx("p",{children:"We don't have any open positions at the moment, but we're always interested in hearing from talented people who are passionate about global health and technology."}),
    u.jsx("p",{children:"Feel free to reach out to us if you'd like to be considered for future opportunities."}),
    u.jsx(qe,{to:"/contact",children:"Get in Touch"})
  ]})})
]})}
`

const bundleWithJobs = `
${aboutBundleSnippet}
function extra(){return u.jsxs("div",{children:[
  u.jsx("h3",{children:"Senior Product Manager"}),
  u.jsx("a",{href:"https://boards.greenhouse.io/nivi/jobs/1234",children:"Apply now"})
]})}
`

const loadModule = async () => {
  try {
    return await import('../../scraper/nivi/script.js')
  } catch {
    assert.fail('Expected NIVI scraper module at ../../scraper/nivi/script.js')
  }
}

test('NIVI sentinel stays pinned to the verified homepage shell and client-bundle careers contract', async () => {
  const nivi = await loadModule()

  assert.equal(nivi.SOURCE, 'nivi')
  assert.equal(nivi.COMPANY, 'NIVI')
  assert.equal(nivi.OFFICIAL_BRAND_NAME, 'Nivi')
  assert.equal(nivi.VERIFIED_ON, '2026-08-21')
  assert.equal(nivi.HOMEPAGE_URL, 'https://nivi.io/')
  assert.equal(nivi.ABOUT_URL, 'https://nivi.io/about')
  assert.equal(nivi.CAREERS_URL, 'https://nivi.io/careers')
  assert.equal(nivi.CLIENT_BUNDLE_URL, 'https://nivi.io/assets/index-tmZUd8-T.js')
  assert.match(nivi.VERIFIED_SURFACE_SUMMARY, /No Open Positions/i)

  assert.equal(nivi.hasOfficialHomepageShellSignal(homepageHtml), true)
  assert.equal(nivi.extractBundleAssetPath(homepageHtml), '/assets/index-tmZUd8-T.js')
  assert.equal(nivi.hasVerifiedAboutCtaSignal(aboutBundleSnippet), true)
  assert.equal(nivi.hasVerifiedNoOpenPositionsSignal(aboutBundleSnippet), true)
  assert.equal(nivi.bundleExposesPublicJobListings(aboutBundleSnippet), false)
  assert.equal(nivi.bundleExposesPublicJobListings(bundleWithJobs), true)
})

test('NIVI returns [] only while the verified client bundle keeps the no-open-positions route intact', async () => {
  const nivi = await loadModule()
  const requestedPages = []
  const requestedText = []

  const jobs = await nivi.createNiviScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === nivi.HOMEPAGE_URL || url === nivi.ABOUT_URL || url === nivi.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      throw new Error(`Unexpected NIVI page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedText.push(url)

      if (url === 'https://nivi.io/assets/index-tmZUd8-T.js') {
        return aboutBundleSnippet
      }

      throw new Error(`Unexpected NIVI text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    nivi.HOMEPAGE_URL,
    nivi.ABOUT_URL,
    nivi.CAREERS_URL,
  ])
  assert.deepEqual(requestedText, ['https://nivi.io/assets/index-tmZUd8-T.js'])
  assert.deepEqual(jobs, [])
})

test('NIVI fails closed when the homepage shell or bundle careers contract changes materially', async () => {
  const nivi = await loadModule()

  await assert.rejects(
    nivi.createNiviScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><body><h1>Nivi</h1></body></html>',
      }),
      fetchText: async () => aboutBundleSnippet,
    }),
    /homepage shell/i,
  )

  await assert.rejects(
    nivi.createNiviScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: homepageHtml,
      }),
      fetchText: async () => bundleWithJobs,
    }),
    /public job/i,
  )
})
