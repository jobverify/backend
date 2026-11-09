import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html>
  <head><title>Join Us | Careers At Mobicule Technologies</title></head>
  <body>
    <h3>Where Innovation Meets Opportunity</h3>
    <a href="https://mobicule.zohorecruit.com/jobs/Careers">Explore opportunities</a>
  </body>
</html>
`

const jobsPayload = {
  code: 'success',
  data: [
    {
      id: '1001',
      Posting_Title: 'Programmer Analyst - Android',
      Job_Opening_Name: 'Programmer Analyst - Android',
      City: 'Mumbai / Pune',
      State: 'Maharashtra',
      Country: 'India',
      Job_Type: 'Full-time',
      Work_Experience: '3-5 years',
      Job_Description: 'Build and ship Android applications.',
      $url: 'https://mobicule.zohorecruit.com/jobs/Careers/1001/programmer-analyst-android',
    },
  ],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mobiculetechnologies/script.js')
  } catch {
    assert.fail('Expected Mobicule Technologies scraper module at ../../scraper/mobiculetechnologies/script.js')
  }
}

test('Mobicule Technologies validates the verified careers page and normalizes India jobs from the public Zoho payload', async () => {
  const mobicule = await loadScriptModule()

  assert.equal(mobicule.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(mobicule.extractIndiaJobs(jobsPayload).length, 1)

  const jobs = await mobicule.run({
    fetchText: async () => careersHtml,
    fetchJson: async () => jobsPayload,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Programmer Analyst - Android',
      company: 'Mobicule Technologies',
      location: 'Mumbai / Pune, Maharashtra, India',
      city: 'Mumbai / Pune',
      state: 'Maharashtra',
      country: 'India',
      jobId: '1001',
      requisitionId: '1001',
      sourceUrl: 'https://mobicule.zohorecruit.com/jobs/Careers/1001/programmer-analyst-android',
      applyUrl: 'https://mobicule.zohorecruit.com/jobs/Careers/1001/programmer-analyst-android',
      employmentType: 'Full-time',
      experienceRequired: '3-5 years',
      description: 'Build and ship Android applications.',
      link: 'https://mobicule.zohorecruit.com/jobs/Careers/1001/programmer-analyst-android',
      source: 'mobiculetechnologies',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('Mobicule Technologies validates the current greytHR company, published feed, locations, and job detail', async () => {
  const mobicule = await loadScriptModule()
  const firstParty = careersHtml.replace('https://mobicule.zohorecruit.com/jobs/Careers', mobicule.CAREERS_PORTAL_URL)
  const job = {
    id: 'f36fda6b-36a7-4c23-abf1-ba5778938c90', title: 'Business Analyst', req_id: '1011',
    slug: 'business-analyst', locations: ['1'], job_type: 'Full-time',
  }
  const expectedUrl = `${mobicule.CAREERS_PORTAL_URL}business-analyst`
  const responses = new Map([
    [mobicule.COMPANY_API_URL, { company_name: 'MOBICULE TECHNOLOGIES PRIVATE LIMITED' }],
    [mobicule.FILTERS_API_URL, { category: [{ name: 'Location', values: [{ id: '1', name: 'Mumbai' }] }] }],
    [mobicule.CAREERS_API_URL, { data: [job] }],
    [`${mobicule.DETAIL_API_ROOT}business-analyst/`, {
      job_status: 'published', job: { ...job, apply_url: expectedUrl,
        description: '<p>Analyze business requirements.</p>', published_on_career_page: '2026-09-30T06:50:13Z' },
    }],
  ])
  assert.equal(mobicule.hasCurrentCareersSignal(firstParty), true)
  const jobs = await mobicule.run({
    fetchText: async url => url === mobicule.CAREERS_URL ? firstParty : '<title>Jobs at MOBICULE TECHNOLOGIES PRIVATE LIMITED</title>',
    fetchJson: async url => responses.get(url),
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Business Analyst')
  assert.equal(jobs[0].location, 'Mumbai, India')
  assert.equal(jobs[0].sourceUrl, expectedUrl)
  assert.equal(jobs[0].postingDate, '2026-09-30')
  responses.set(mobicule.FILTERS_API_URL, { category: [{ name: 'Location', values: [{ id: '1', name: 'Unknown' }] }] })
  await assert.rejects(mobicule.run({
    fetchText: async url => url === mobicule.CAREERS_URL ? firstParty : '<title>Jobs at MOBICULE TECHNOLOGIES PRIVATE LIMITED</title>',
    fetchJson: async url => responses.get(url),
  }), /geography is unverified/i)
})
