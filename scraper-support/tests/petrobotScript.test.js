import assert from 'node:assert/strict'
import test from 'node:test'

const loadPetroBotModule = async () => {
  try {
    return await import('../../scraper/petrobot/script.js')
  } catch {
    assert.fail('Expected PetroBot scraper module at ../../scraper/petrobot/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at PetroBot - Robotics and NDT Inspection Jobs</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Join our team and help build the future of robotic inspection technology.</p>
      <section>
        <h2>Open Positions</h2>
        <a href="https://careers.smartrecruiters.com/PetroBotTechnologiesPvtLtd">
          View all positions on SmartRecruiters
        </a>
      </section>
      <footer>
        <p>PetroBot, inspecting assets where humans shouldn't have to go.</p>
        <p>Developed in India. Funded by ONGC &amp; HPCL.</p>
        <p>© 2026 PetroBot Technologies Pvt. Ltd.</p>
      </footer>
    </main>
  </body>
</html>
`

const smartRecruitersListingsPayload = {
  totalFound: 1,
  content: [
    {
      id: '744000132029834',
      name: 'Business Development Executive (BDE)- Robotics/ Oil & Gas',
      refNumber: 'REF40R',
      releasedDate: '2026-06-13T08:40:22.381Z',
      location: {
        city: 'Jaipur',
        region: 'RJ',
        country: 'in',
        fullLocation: 'Jaipur, RJ, India',
      },
      company: {
        identifier: 'PetroBotTechnologiesPvtLtd',
        name: 'PetroBot Technologies Pvt Ltd',
      },
      department: {},
      typeOfEmployment: {
        id: 'permanent',
        label: 'Full-time',
      },
      experienceLevel: {
        id: 'executive',
        label: 'Executive',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/PetroBotTechnologiesPvtLtd/postings/744000132029834',
    },
  ],
}

const smartRecruitersDetailPayload = {
  id: '744000132029834',
  name: 'Business Development Executive (BDE)- Robotics/ Oil & Gas',
  refNumber: 'REF40R',
  releasedDate: '2026-06-13T08:40:22.381Z',
  postingUrl:
    'https://jobs.smartrecruiters.com/PetroBotTechnologiesPvtLtd/744000132029834-business-development-executive-bde-robotics-oil-gas',
  applyUrl:
    'https://jobs.smartrecruiters.com/PetroBotTechnologiesPvtLtd/744000132029834-business-development-executive-bde-robotics-oil-gas?oga=true',
  location: {
    city: 'Jaipur',
    region: 'RJ',
    country: 'in',
    fullLocation: 'Jaipur, RJ, India',
  },
  department: {},
  typeOfEmployment: {
    id: 'permanent',
    label: 'Full-time',
  },
  experienceLevel: {
    id: 'executive',
    label: 'Executive',
  },
  jobAd: {
    sections: {
      jobDescription: {
        text: `
          <p>Job Title: Business Development Executive (BDE) - Robotics/Oil &amp; Gas</p>
          <p>What You Will Do (Responsibilities): Lead Generation: Find new B2B leads using the company's outreach stack.</p>
        `,
      },
      qualifications: {
        text: `
          <p>What We Are Looking For (Requirements):</p>
          <p>Education: B.Tech in Mechanical Engineering is highly preferred.</p>
        `,
      },
      additionalInformation: {
        text: `
          <p>Candidate Profile</p>
          <p>Growth Mindset: Interested in long-term employment with a desire to move up within the company.</p>
        `,
      },
    },
  },
}

test('PetroBot constants stay pinned to the verified first-party careers handoff and SmartRecruiters board', async () => {
  const petrobot = await loadPetroBotModule()

  assert.equal(petrobot.SOURCE, 'petrobot')
  assert.equal(petrobot.COMPANY, 'PetroBot')
  assert.equal(petrobot.CAREERS_URL, 'https://petrobot.co.in/company/careers')
  assert.equal(
    petrobot.SMARTRECRUITERS_BOARD_URL,
    'https://careers.smartrecruiters.com/PetroBotTechnologiesPvtLtd',
  )
  assert.equal(petrobot.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    petrobot.extractVerifiedJobsBoardUrl(officialCareersHtml),
    'https://careers.smartrecruiters.com/PetroBotTechnologiesPvtLtd',
  )
})

test('PetroBot run validates the first-party careers handoff and maps SmartRecruiters jobs', async () => {
  const petrobot = await loadPetroBotModule()
  const requestedUrls = []

  const jobs = await petrobot.createPetroBotScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, petrobot.CAREERS_URL)
      return officialCareersHtml
    },
    fetchJson: async (url, options = {}) => {
      requestedUrls.push(url)

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/PetroBotTechnologiesPvtLtd/postings?limit=100&country=in&offset=0'
      ) {
        assert.equal(options.method, 'GET')
        return smartRecruitersListingsPayload
      }

      if (
        url
        === 'https://api.smartrecruiters.com/v1/companies/PetroBotTechnologiesPvtLtd/postings/744000132029834'
      ) {
        return smartRecruitersDetailPayload
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    petrobot.CAREERS_URL,
    'https://api.smartrecruiters.com/v1/companies/PetroBotTechnologiesPvtLtd/postings?limit=100&country=in&offset=0',
    'https://api.smartrecruiters.com/v1/companies/PetroBotTechnologiesPvtLtd/postings/744000132029834',
  ])

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Business Development Executive (BDE)- Robotics/ Oil & Gas',
    company: 'PetroBot',
    location: 'Jaipur, RJ, India',
    city: 'Jaipur',
    country: 'India',
    link:
      'https://jobs.smartrecruiters.com/PetroBotTechnologiesPvtLtd/744000132029834-business-development-executive-bde-robotics-oil-gas',
    applyUrl:
      'https://jobs.smartrecruiters.com/PetroBotTechnologiesPvtLtd/744000132029834-business-development-executive-bde-robotics-oil-gas?oga=true',
    sourceUrl:
      'https://jobs.smartrecruiters.com/PetroBotTechnologiesPvtLtd/744000132029834-business-development-executive-bde-robotics-oil-gas',
    source: 'petrobot',
    jobId: '744000132029834',
    requisitionId: 'REF40R',
    department: null,
    employmentType: 'Full-time',
    experienceRequired: null,
    experienceLevel: 'Executive',
    postingDate: '2026-06-13T08:40:22.381Z',
    jobDescription: jobs[0].jobDescription,
    minimumQualification: jobs[0].minimumQualification,
    preferredQualification: jobs[0].preferredQualification,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })

  assert.match(jobs[0].jobDescription, /Lead Generation/i)
  assert.match(jobs[0].minimumQualification, /Mechanical Engineering/i)
  assert.match(jobs[0].preferredQualification, /Growth Mindset/i)
})

test('PetroBot fails closed when the verified first-party careers handoff changes', async () => {
  const petrobot = await loadPetroBotModule()

  await assert.rejects(
    petrobot.createPetroBotScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /official careers surface changed/i,
  )

  await assert.rejects(
    petrobot.createPetroBotScraper().run({
      fetchText: async () => officialCareersHtml.replace(
        'https://careers.smartrecruiters.com/PetroBotTechnologiesPvtLtd',
        'https://careers.smartrecruiters.com/AnotherCompany',
      ),
      fetchJson: async () => smartRecruitersListingsPayload,
    }),
    /verified smartrecruiters handoff changed/i,
  )
})
