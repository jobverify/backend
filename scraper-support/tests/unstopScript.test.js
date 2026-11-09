import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html>
  <head>
    <link rel="canonical" href="https://unstop.com/about/unstop-careers" />
  </head>
  <body>
    <h2>Opportunities at Unstop</h2>
    <a href="https://unstop.com/jobs/business-operations-specialist-hybrid-mode-unstop-1559736">
      <span>Business Operations Specialist (Hybrid Mode)</span>
    </a>
    <a href="https://unstop.com/jobs/front-end-engineer-unstop-699743">Front End Engineer</a>
    <a href="https://unstop.com/jobs/front-end-engineer-unstop-699743">Duplicate</a>
    <a href="https://unstop.com/internship/research-intern-unstop-123">Research Intern</a>
    <a href="https://example.com/jobs/not-unstop-1">Not first-party</a>
  </body>
</html>
`

const loadUnstopModule = async () => import('../../scraper/unstop/script.js')

test('Unstop recognizes the verified first-party AMP careers surface and extracts only job links', async () => {
  const unstop = await loadUnstopModule()

  assert.equal(unstop.SOURCE, 'unstop')
  assert.equal(unstop.COMPANY, 'Unstop')
  assert.equal(unstop.VERIFIED_ON, '2026-07-25')
  assert.equal(unstop.CAREERS_PAGE_URL, 'https://unstop.com/about/unstop-careers/amp')
  assert.equal(unstop.hasTrustedCareersSignal(careersHtml), true)
  assert.deepEqual(unstop.extractJobs(careersHtml), [
    {
      title: 'Business Operations Specialist (Hybrid Mode)',
      company: 'Unstop',
      location: 'India',
      link: 'https://unstop.com/jobs/business-operations-specialist-hybrid-mode-unstop-1559736',
      applyUrl: 'https://unstop.com/jobs/business-operations-specialist-hybrid-mode-unstop-1559736',
      source: 'unstop',
    },
    {
      title: 'Front End Engineer',
      company: 'Unstop',
      location: 'India',
      link: 'https://unstop.com/jobs/front-end-engineer-unstop-699743',
      applyUrl: 'https://unstop.com/jobs/front-end-engineer-unstop-699743',
      source: 'unstop',
    },
  ])
})

test('Unstop fails closed when the stable AMP careers contract drifts', async () => {
  const unstop = await loadUnstopModule()

  await assert.rejects(
    unstop.createUnstopScraper().run({
      fetchPage: async () => ({ status: 200, url: unstop.CAREERS_PAGE_URL, html: '<html><body>Unexpected</body></html>' }),
    }),
    /verified careers page/i,
  )
})
