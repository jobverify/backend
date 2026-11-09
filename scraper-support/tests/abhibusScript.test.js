import assert from 'node:assert/strict'
import test from 'node:test'

const loadAbhiBusModule = async () => {
  try {
    return await import('../../scraper/abhibus/script.js')
  } catch {
    assert.fail('Expected AbhiBus scraper module at ../../scraper/abhibus/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ixigo &amp; AbhiBus Careers - Changing the way India travels</title>
  </head>
  <body>
    <main>
      <section id="jobs" class="jobs-section">
        <div class="section-head">
          <span class="eyebrow">Open Positions</span>
          <h2>Find your next role.</h2>
          <p>
            Live AbhiBus openings from SmartRecruiters. Explore the role that fits
            and apply directly through the official hiring portal.
          </p>
        </div>
        <a class="jobs-source-link" href="https://jobs.smartrecruiters.com/AbhiBus">SmartRecruiters</a>
        <div class="jobs-grid reveal-stagger" id="jobsGrid" aria-live="polite">
          <div class="job-card job-card-loading">Loading roles</div>
        </div>
        <script>
          const jobsEndpoint = 'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings?limit=100';
          const getJobUrl = (job) => \`https://jobs.smartrecruiters.com/AbhiBus/\${job.id}-\${job.name}\`;
        </script>
      </section>
    </main>
  </body>
</html>
`

const smartRecruitersListingsPayload = {
  offset: 0,
  limit: 100,
  totalFound: 2,
  content: [
    {
      id: '744000137114521',
      name: 'AI-Native Full Stack Developer Intern',
      refNumber: 'REF179N',
      releasedDate: '2026-07-10T11:58:35.636Z',
      company: {
        identifier: 'AbhiBus',
        name: 'AbhiBus',
      },
      location: {
        city: 'Hyderabad',
        region: 'TS',
        country: 'in',
        fullLocation: 'Hyderabad, TS, India',
        remote: false,
        hybrid: false,
      },
      function: {
        id: 'engineering',
        label: 'Engineering',
      },
      department: {},
      typeOfEmployment: {
        id: 'permanent',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'internship',
        label: 'Internship',
      },
      visibility: 'PUBLIC',
      ref: 'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings/744000137114521',
    },
    {
      id: '744000137000000',
      name: 'Non India Role',
      refNumber: 'REF999X',
      company: {
        identifier: 'AbhiBus',
        name: 'AbhiBus',
      },
      location: {
        city: 'Dubai',
        country: 'ae',
        fullLocation: 'Dubai, United Arab Emirates',
      },
      function: {
        label: 'Sales',
      },
      visibility: 'PUBLIC',
      ref: 'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings/744000137000000',
    },
  ],
}

const smartRecruitersDetailPayload = {
  id: '744000137114521',
  name: 'AI-Native Full Stack Developer Intern',
  refNumber: 'REF179N',
  releasedDate: '2026-07-10T11:58:35.636Z',
  postingUrl:
    'https://jobs.smartrecruiters.com/AbhiBus/744000137114521-ai-native-full-stack-developer-intern',
  applyUrl:
    'https://jobs.smartrecruiters.com/AbhiBus/744000137114521-ai-native-full-stack-developer-intern?oga=true',
  jobAd: {
    sections: {
      jobDescription: {
        text: '<p>Build real-world web applications with React.js and Node.js.</p>',
      },
      qualifications: {
        text: '<p>Good understanding of JavaScript (ES6+).</p>',
      },
      additionalInformation: {
        text: '<p>Candidates are responsible for safeguarding sensitive company data.</p>',
      },
    },
  },
}

test('AbhiBus pins the verified first-party careers page and SmartRecruiters API handoff', async () => {
  const abhibus = await loadAbhiBusModule()

  assert.equal(abhibus.SOURCE, 'abhibus')
  assert.equal(abhibus.COMPANY, 'AbhiBus')
  assert.equal(abhibus.VERIFIED_AT, '2026-07-19')
  assert.equal(abhibus.CAREERS_URL, 'https://www.abhibus.com/careers/')
  assert.equal(abhibus.SMARTRECRUITERS_COMPANY_IDENTIFIER, 'AbhiBus')
  assert.equal(
    abhibus.SMARTRECRUITERS_LISTING_API_URL,
    'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings',
  )
  assert.equal(abhibus.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    abhibus.extractSmartRecruitersListingApiUrl(officialCareersHtml),
    'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings',
  )
  assert.equal(
    abhibus.hasVerifiedZeroListingsState({ ...smartRecruitersListingsPayload, totalFound: 0, content: [] }),
    true,
  )
  assert.equal(abhibus.hasVerifiedZeroListingsState(smartRecruitersListingsPayload), false)
  assert.equal(
    abhibus.extractSmartRecruitersCompanyIdentifier(
      'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings?limit=100',
    ),
    'AbhiBus',
  )
  assert.equal(
    abhibus.extractSmartRecruitersCompanyIdentifier(
      'https://jobs.smartrecruiters.com/AbhiBus/744000137114521-ai-native-full-stack-developer-intern',
    ),
    'AbhiBus',
  )
})

test('AbhiBus run validates the official careers page and maps public SmartRecruiters India jobs', async () => {
  const abhibus = await loadAbhiBusModule()
  const requestedUrls = []

  const jobs = await abhibus.createAbhiBusScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, abhibus.CAREERS_URL)
      return officialCareersHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings?limit=100&country=in&offset=0'
      ) {
        return smartRecruitersListingsPayload
      }

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings/744000137114521'
      ) {
        return smartRecruitersDetailPayload
      }

      throw new Error(`Unexpected AbhiBus fixture URL: ${url}`)
    },
    now: () => '2026-07-19T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    abhibus.CAREERS_URL,
    'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings?limit=100&country=in&offset=0',
    'https://api.smartrecruiters.com/v1/companies/AbhiBus/postings/744000137114521',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'AI-Native Full Stack Developer Intern',
      company: 'AbhiBus',
      department: 'Engineering',
      location: 'Hyderabad, TS, India',
      city: 'Hyderabad',
      country: 'India',
      link:
        'https://jobs.smartrecruiters.com/AbhiBus/744000137114521-ai-native-full-stack-developer-intern',
      applyUrl:
        'https://jobs.smartrecruiters.com/AbhiBus/744000137114521-ai-native-full-stack-developer-intern?oga=true',
      sourceUrl:
        'https://jobs.smartrecruiters.com/AbhiBus/744000137114521-ai-native-full-stack-developer-intern',
      source: 'abhibus',
      jobId: '744000137114521',
      requisitionId: 'REF179N',
      employmentType: 'Full-time',
      experienceRequired: null,
      experienceLevel: 'Internship',
      minimumQualification: 'Good understanding of JavaScript (ES6+).',
      preferredQualification: 'Candidates are responsible for safeguarding sensitive company data.',
      requiredSkills: [],
      postingDate: '2026-07-10T11:58:35.636Z',
      closingDate: null,
      jobDescription: 'Build real-world web applications with React.js and Node.js.',
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-19T00:00:00.000Z',
    },
  ])
})

test('AbhiBus returns [] while the verified SmartRecruiters API reports zero live openings', async () => {
  const abhibus = await loadAbhiBusModule()

  const jobs = await abhibus.createAbhiBusScraper().run({
    fetchText: async () => officialCareersHtml,
    fetchJson: async () => ({ ...smartRecruitersListingsPayload, totalFound: 0, content: [] }),
  })

  assert.deepEqual(jobs, [])
})

test('AbhiBus fails closed when the verified SmartRecruiters API contract changes', async () => {
  const abhibus = await loadAbhiBusModule()

  await assert.rejects(
    abhibus.createAbhiBusScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    abhibus.createAbhiBusScraper().run({
      fetchText: async () => officialCareersHtml.replaceAll('/AbhiBus/', '/AnotherCompany/'),
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /smartrecruiters api handoff/i,
  )
})
