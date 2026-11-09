import assert from 'node:assert/strict'
import test from 'node:test'

const loadDeduceTechnologiesModule = async () => {
  try {
    return await import('../../scraper/deducetechnologies/script.js')
  } catch {
    assert.fail('Expected Deduce Technologies scraper module at ../../scraper/deducetechnologies/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Deduce — AI-Powered Maps &amp; Location Intelligence Platform</title>
    <meta
      name="description"
      content="Deduce is a leading technology firm offering AI-powered products and services for mapping, geospatial data, and location intelligence. Explore our innovations in AI, EV charging, geoboundaries, and advanced navigation."
    />
    <meta property="og:title" content="Deduce — AI-Powered Maps &amp; Location Intelligence" />
    <meta property="og:description" content="Deduce Technologies — Maps, geospatial AI, and computer vision products." />
    <link rel="canonical" href="https://www.deducetechnologies.com/" />
    <script type="module" crossorigin src="/assets/index-B-wPftlC.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const careersBundleJs = `
const navItems=[{title:"Company",link:"/company"},{title:"Careers",link:"/careers"}];
const footerItems=[{label:"Who we are",path:"/company"},{label:"Careers",path:"/Careers"}];
const careersSection={
  title:"Careers",
  heading:"Open Positions",
  cta:{label:"Apply Now",to:"https://docs.google.com/forms/d/e/1FAIpQLSdpIy90cZXf1CeK36yWfJ4GxcNCsnGa_6hWoQiLQcxOVBtcdg/viewform"}
};
`

test('Deduce Technologies validates the current Friday, August 7, 2026 SPA careers apply-only surface before returning no listings', async () => {
  const deduceTechnologies = await loadDeduceTechnologiesModule()
  const requestedUrls = []

  assert.equal(deduceTechnologies.HOMEPAGE_URL, 'https://www.deducetechnologies.com/')
  assert.equal(deduceTechnologies.CAREERS_URL, 'https://www.deducetechnologies.com/careers')
  assert.equal(
    deduceTechnologies.extractBundleUrl(homepageHtml),
    'https://www.deducetechnologies.com/assets/index-B-wPftlC.js',
  )
  assert.equal(deduceTechnologies.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(deduceTechnologies.hasVerifiedApplyOnlyCareersSignal(careersBundleJs), true)
  assert.equal(deduceTechnologies.hasPublicJobBoardSignal(careersBundleJs), false)

  const jobs = await deduceTechnologies.createDeduceTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === deduceTechnologies.HOMEPAGE_URL) return homepageHtml
      if (url === deduceTechnologies.extractBundleUrl(homepageHtml)) return careersBundleJs
      throw new Error(`Unexpected Deduce Technologies fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    deduceTechnologies.HOMEPAGE_URL,
    deduceTechnologies.extractBundleUrl(homepageHtml),
  ])
  assert.deepEqual(jobs, [])
})

test('Deduce Technologies fails closed when the official homepage shell changes', async () => {
  const deduceTechnologies = await loadDeduceTechnologiesModule()

  await assert.rejects(
    deduceTechnologies.createDeduceTechnologiesScraper().run({
      fetchText: async () => '<html><head><title>Example</title></head><body></body></html>',
    }),
    /Deduce Technologies official public site changed/i,
  )
})

test('Deduce Technologies fails closed when the verified apply-only careers route disappears or public listings appear', async () => {
  const deduceTechnologies = await loadDeduceTechnologiesModule()

  await assert.rejects(
    deduceTechnologies.createDeduceTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === deduceTechnologies.HOMEPAGE_URL) return homepageHtml
        return 'const navItems=[{title:"Company",link:"/company"}];'
      },
    }),
    /Deduce Technologies verified apply-only careers surface changed/i,
  )

  await assert.rejects(
    deduceTechnologies.createDeduceTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === deduceTechnologies.HOMEPAGE_URL) return homepageHtml
        return `
          ${careersBundleJs}
          const publicJobs="https://jobs.lever.co/deducetechnologies";
          const jobs=[{title:"GIS Engineer",link:"/careers/gis-engineer"}];
        `
      },
    }),
    /Deduce Technologies careers surface now exposes public job listings/i,
  )
})
