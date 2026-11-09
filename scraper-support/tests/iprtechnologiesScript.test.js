import assert from 'node:assert/strict'
import test from 'node:test'

const loadIPRTechnologiesModule = async () => {
  try {
    return await import('../../scraper/iprtechnologies/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>IPR Technologies Pvt Ltd</title>
    </head>
    <body>
      <nav>
        <a href="https://iprtechnologies.com/">Home</a>
        <a href="https://iprtechnologies.com/services/">Services</a>
        <a href="https://iprtechnologies.com/case-studies/">Case Studies</a>
        <a href="https://iprtechnologies.com/resources/">Resources</a>
        <a href="https://iprtechnologies.com/testimonials/">Testimonials</a>
        <a href="https://iprtechnologies.com/insights/">Insights</a>
      </nav>
    </body>
  </html>
`

const publishedPages = [
  { slug: 'home', title: { rendered: 'Home' }, link: 'https://iprtechnologies.com/' },
  { slug: 'services', title: { rendered: 'Services' }, link: 'https://iprtechnologies.com/services/' },
  { slug: 'case-studies', title: { rendered: 'Case Studies' }, link: 'https://iprtechnologies.com/case-studies/' },
  { slug: 'resources', title: { rendered: 'Resources' }, link: 'https://iprtechnologies.com/resources/' },
  { slug: 'testimonials', title: { rendered: 'Testimonials' }, link: 'https://iprtechnologies.com/testimonials/' },
  { slug: 'insights', title: { rendered: 'Insights' }, link: 'https://iprtechnologies.com/insights/' },
]

test('hasPublicCareersPage stays false when the official site publishes no careers-related pages', async () => {
  const iprTechnologies = await loadIPRTechnologiesModule()
  assert.ok(iprTechnologies)

  assert.equal(iprTechnologies.hasOfficialSiteSignal(homepageHtml), true)
  assert.deepEqual(iprTechnologies.extractPublishedPageSlugs(publishedPages), [
    'home',
    'services',
    'case-studies',
    'resources',
    'testimonials',
    'insights',
  ])
  assert.equal(iprTechnologies.hasPublicCareersPage(publishedPages), false)
})

test('run returns no jobs when IPR Technologies publishes no public careers pages', async () => {
  const iprTechnologies = await loadIPRTechnologiesModule()
  assert.ok(iprTechnologies)

  const requestedUrls = []
  const jobs = await iprTechnologies.createIPRTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === iprTechnologies.CAREER_PAGE_URL) {
        return homepageHtml
      }

      if (url === iprTechnologies.PAGES_API_URL) {
        return JSON.stringify(publishedPages)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://iprtechnologies.com/',
    'https://iprtechnologies.com/wp-json/wp/v2/pages?per_page=100',
  ])
  assert.deepEqual(jobs, [])
})
