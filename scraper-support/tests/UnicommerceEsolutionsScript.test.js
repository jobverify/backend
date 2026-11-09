import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Openings, Jobs at unicommerce - Unicommerce.com</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Current openings are:</p>
      <section class="opening">
        <h4>Senior/Java Developer (Java/J2EE, Webservices)</h4>
        <p>Qualification : B.Tech from Premier Institutes</p>
        <p>Experience : 2 to 6 years.</p>
        <p>The ideal candidates will have at least 2-6 years of programming experience in Java with a good understanding of object oriented programming concepts.</p>
        <p>Apply Now</p>
      </section>
      <section class="opening">
        <h4>Senior/User Interface Developer (JQuery, CSS/XHTML, Web 2.0)</h4>
        <p>Qualification : B.Tech from Premier Institutes</p>
        <p>Experience : 2+ years.</p>
        <p>The ideal candidates will be highly skilled in web design and implementation with a passion for building great web-based user interfaces.</p>
        <p>Apply Now</p>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/unicommerceesolutions/script.js')
  } catch {
    assert.fail('Expected Unicommerce Esolutions scraper module at ../../scraper/unicommerceesolutions/script.js')
  }
}

test('Unicommerce Esolutions helpers stay pinned to the verified first-party current openings page', async () => {
  const unicommerce = await loadModule()

  assert.equal(unicommerce.SOURCE, 'unicommerceesolutions')
  assert.equal(unicommerce.COMPANY, 'Unicommerce Esolutions')
  assert.equal(unicommerce.CAREERS_URL, 'https://services.unicommerce.com/aboutus/careers')
  assert.equal(unicommerce.VERIFIED_ON, '2026-07-18')
  assert.equal(unicommerce.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(unicommerce.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.deepEqual(unicommerce.extractJobs(careersHtml), [
    {
      title: 'Senior/Java Developer (Java/J2EE, Webservices)',
      company: 'Unicommerce Esolutions',
      department: 'Engineering',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'senior-java-developer-java-j2ee-webservices',
      requisitionId: 'senior-java-developer-java-j2ee-webservices',
      sourceUrl: 'https://services.unicommerce.com/aboutus/careers',
      applyUrl: 'https://services.unicommerce.com/aboutus/careers',
      employmentType: null,
      experienceRequired: '2 to 6 years',
      minimumQualification: 'B.Tech from Premier Institutes',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'The ideal candidates will have at least 2-6 years of programming experience in Java with a good understanding of object oriented programming concepts.',
      remoteStatus: null,
    },
    {
      title: 'Senior/User Interface Developer (JQuery, CSS/XHTML, Web 2.0)',
      company: 'Unicommerce Esolutions',
      department: 'Engineering',
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'senior-user-interface-developer-jquery-css-xhtml-web-2-0',
      requisitionId: 'senior-user-interface-developer-jquery-css-xhtml-web-2-0',
      sourceUrl: 'https://services.unicommerce.com/aboutus/careers',
      applyUrl: 'https://services.unicommerce.com/aboutus/careers',
      employmentType: null,
      experienceRequired: '2+ years',
      minimumQualification: 'B.Tech from Premier Institutes',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'The ideal candidates will be highly skilled in web design and implementation with a passion for building great web-based user interfaces.',
      remoteStatus: null,
    },
  ])
})

test('Unicommerce Esolutions run validates the verified current openings page before decorating extracted jobs', async () => {
  const unicommerce = await loadModule()
  const requestedUrls = []

  const jobs = await unicommerce.createUnicommerceEsolutionsScraper({ maxJobs: 1 }).run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === unicommerce.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Unicommerce URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [unicommerce.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'unicommerceesolutions')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].link, 'https://services.unicommerce.com/aboutus/careers')
})

test('Unicommerce Esolutions run fails closed when the verified current openings page drifts', async () => {
  const unicommerce = await loadModule()

  await assert.rejects(
    unicommerce.createUnicommerceEsolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified unicommerce current openings page/i,
  )
})
