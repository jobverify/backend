import assert from 'node:assert/strict'
import test from 'node:test'

const faqWlan = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Software Engineer / WLAN TestingHyderabad       Posted on 23 July 2023Hybrid',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '<div><ul><li><b>Location</b>: Hyderabad</li><li>Hybrid</li><li><b>Experience</b>: 2-6yrs</li><li><b>Qualification:</b> BE/BTech/ME/MTech</li><li><b>Industry-required</b>: IT</li></ul><div><ul><li>Design, develop, debug, test the wlan driver and android wi-fi framework.</li><li>Optimize and improve stability and throughput.</li><li>Track the progress of wi-fi related certifications.</li></ul></div></div>',
      },
    },
  ],
})

const faqAudio = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Software Engineer / Audio/Video SoftwareHyderabad       Posted on 10 July 2023Hybrid',
      acceptedAnswer: {
        '@type': 'Answer',
        text: '<div><ul><li>Posted on 10 July 2023</li><li><b>Location</b>: Hyderabad</li><li>Hybrid</li><li><b>Experience</b>: 2-6yrs</li><li><b>Qualification:</b> BE/BTech/ME/MTech</li></ul><div><ul><li>Android audio/video framework maintenance and new feature development.</li><li>Design and implementation of Android audio and video software.</li></ul></div></div>',
      },
    },
  ],
})

const CAREERS_PAGE_HTML = `
<!doctype html>
<html>
  <head>
    <title>Careers &#8211; Votary Tech</title>
  </head>
  <body>
    <h4>Featured Jobs</h4>
    <h4>Current Openings</h4>
    <div>Software Engineer / WLAN Testing</div>
    <script type="application/ld+json">${faqWlan}</script>
    <script type="application/ld+json">${faqAudio}</script>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/votarysoftechsolutions/script.js')
  } catch {
    assert.fail('Expected Votary Softech Solutions scraper module at ../../scraper/votarysoftechsolutions/script.js')
  }
}

test('Votary Softech Solutions parses first-party FAQ role entries from the careers page', async () => {
  const votary = await loadScriptModule()
  const jobs = votary.extractFaqJobEntries(CAREERS_PAGE_HTML)

  assert.equal(votary.hasOfficialCareersSignal(CAREERS_PAGE_HTML), true)
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Software Engineer / WLAN Testing', 'Software Engineer / Audio/Video Software'],
  )
  assert.equal(jobs[0].location, 'Hyderabad')
  assert.equal(jobs[0].experienceRequired, '2-6yrs')
})

test('Votary Softech Solutions returns normalized jobs from the verified careers page', async () => {
  const votary = await loadScriptModule()

  const jobs = await votary.createVotarySoftechSolutionsScraper().run({
    fetchText: async () => CAREERS_PAGE_HTML,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Votary Softech Solutions')
  assert.equal(jobs[0].source, 'votarysoftechsolutions')
  assert.equal(jobs[0].companyDomain, 'votarytech.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
