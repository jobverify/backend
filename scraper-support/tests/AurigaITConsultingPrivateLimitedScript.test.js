import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Make the RIGHT move!</h1>
    <a href="https://aurigait.keka.com/careers">Find Job Openings</a>
    <div>Join Us and work with friends for a lifetime</div>
  </body>
</html>
`

const kekaShellHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      fetch('/ats/documents/portal/careerportal/auriga-careers.html')
    </script>
  </body>
</html>
`

const kekaPortalHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      window.khConfig = {
        identifier: 'auriga-identifier',
        domain: 'https://aurigait.keka.com/careers',
        portalName: 'default'
      };
    </script>
  </body>
</html>
`

const activeJobsPayload = [
  {
    id: '501',
    jobNumber: 'AUR-501',
    title: 'Backend Engineer',
    departmentName: 'Engineering',
    experience: '4-7 years',
    description: 'Build internal platforms.',
    jobType: 2,
    skillNames: ['Node.js', 'PostgreSQL'],
    jobLocations: [
      { city: 'Jaipur', state: 'Rajasthan', countryCode: 'IN', countryName: 'India' },
    ],
  },
  {
    id: '502',
    jobNumber: 'AUR-502',
    title: 'Sales Manager',
    departmentName: 'Sales',
    experience: '5+ years',
    description: 'Non-India role.',
    jobType: 2,
    skillNames: ['B2B'],
    jobLocations: [
      { city: 'Austin', state: 'Texas', countryCode: 'US', countryName: 'United States' },
    ],
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/aurigaitconsultingprivatelimited/script.js')
  } catch {
    assert.fail('Expected Auriga IT Consulting Private Limited scraper module at ../../scraper/aurigaitconsultingprivatelimited/script.js')
  }
}

test('Auriga IT Consulting Private Limited helpers stay pinned to the verified first-party shell and Keka handoff', async () => {
  const auriga = await loadModule()

  assert.equal(auriga.SOURCE, 'aurigaitconsultingprivatelimited')
  assert.equal(auriga.COMPANY, 'Auriga IT Consulting Private Limited')
  assert.equal(auriga.CAREERS_URL, 'https://aurigait.com/careers/')
  assert.equal(auriga.KEKA_CAREERS_URL, 'https://aurigait.keka.com/careers')
  assert.equal(auriga.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(auriga.extractKekaHandoffUrl(officialCareersHtml), 'https://aurigait.keka.com/careers')
  assert.equal(
    auriga.extractBootstrapDocumentUrl(kekaShellHtml),
    'https://aurigait.keka.com/ats/documents/portal/careerportal/auriga-careers.html',
  )
  assert.deepEqual(auriga.extractCareerConfig(kekaPortalHtml), {
    identifier: 'auriga-identifier',
    domain: 'https://aurigait.keka.com/careers/',
    portalName: 'default',
  })
})

test('Auriga IT Consulting Private Limited run validates the first-party shell and maps India Keka jobs', async () => {
  const auriga = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await auriga.createAurigaItConsultingPrivateLimitedScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === auriga.CAREERS_URL) return officialCareersHtml
      if (url === auriga.KEKA_CAREERS_URL) return kekaShellHtml
      if (url === 'https://aurigait.keka.com/ats/documents/portal/careerportal/auriga-careers.html') return kekaPortalHtml
      throw new Error(`Unexpected Auriga text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      return activeJobsPayload
    },
  })

  assert.deepEqual(requestedTextUrls, [
    auriga.CAREERS_URL,
    auriga.KEKA_CAREERS_URL,
    'https://aurigait.keka.com/ats/documents/portal/careerportal/auriga-careers.html',
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://aurigait.keka.com/careers/api/embedjobs/default/active/auriga-identifier',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Backend Engineer')
  assert.equal(jobs[0].source, 'aurigaitconsultingprivatelimited')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Auriga IT Consulting Private Limited fails closed when the verified shell or Keka config changes', async () => {
  const auriga = await loadModule()

  await assert.rejects(
    auriga.createAurigaItConsultingPrivateLimitedScraper().run({
      fetchText: async (url) => (url === auriga.CAREERS_URL ? '<html></html>' : kekaShellHtml),
      fetchJson: async () => activeJobsPayload,
    }),
    /verified auriga careers page/i,
  )

  await assert.rejects(
    auriga.createAurigaItConsultingPrivateLimitedScraper().run({
      fetchText: async (url) => (url === auriga.CAREERS_URL ? officialCareersHtml : '<html></html>'),
      fetchJson: async () => activeJobsPayload,
    }),
    /unable to resolve auriga keka embed configuration/i,
  )
})
