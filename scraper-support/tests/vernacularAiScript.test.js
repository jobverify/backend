import assert from 'node:assert/strict'
import test from 'node:test'

const loadVernacularAiModule = async () => {
  try {
    return await import('../../scraper/vernacularai/script.js')
  } catch {
    assert.fail('Expected Vernacular.ai scraper module at ../../scraper/vernacularai/script.js')
  }
}

const indiaListing = {
  id: '111111',
  name: 'Campaign Analyst',
  refNumber: 'VA-111111',
  releasedDate: '2026-07-25T00:00:00.000Z',
  company: { identifier: 'Vernacularai', name: 'Vernacular.ai' },
  location: {
    city: 'Bengaluru',
    region: 'Karnataka',
    country: 'in',
    fullLocation: 'Bengaluru, Karnataka, India',
  },
  function: { label: 'Operations' },
  typeOfEmployment: { label: 'Full-time' },
  visibility: 'PUBLIC',
  ref: 'https://api.smartrecruiters.com/v1/companies/vernacularai/postings/111111',
}

test('Vernacular.ai maps India jobs only from its pinned SmartRecruiters tenant', async () => {
  const vernacularAi = await loadVernacularAiModule()
  const jobs = await vernacularAi.createVernacularAiScraper().run({
    fetchJson: async (url) => {
      if (url.includes('/postings?')) return { offset: 0, totalFound: 1, content: [indiaListing] }
      return {
        ...indiaListing,
        postingUrl: 'https://jobs.smartrecruiters.com/Vernacularai/111111-campaign-analyst',
        applyUrl: 'https://jobs.smartrecruiters.com/Vernacularai/111111-campaign-analyst?oga=true',
        jobAd: { sections: { jobDescription: { text: '<p>Support campaigns.</p>' } } },
      }
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [{
    title: 'Campaign Analyst',
    company: 'Vernacular.ai',
    department: 'Operations',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://jobs.smartrecruiters.com/Vernacularai/111111-campaign-analyst',
    applyUrl: 'https://jobs.smartrecruiters.com/Vernacularai/111111-campaign-analyst?oga=true',
    sourceUrl: 'https://jobs.smartrecruiters.com/Vernacularai/111111-campaign-analyst',
    source: 'vernacularai',
    jobId: '111111',
    requisitionId: 'VA-111111',
    employmentType: 'Full-time',
    postingDate: '2026-07-25T00:00:00.000Z',
    jobDescription: 'Support campaigns.',
    scrapedAt: '2026-07-25T00:00:00.000Z',
  }])
})

test('Vernacular.ai fails closed when the SmartRecruiters tenant or application host changes', async () => {
  const vernacularAi = await loadVernacularAiModule()

  await assert.rejects(
    vernacularAi.createVernacularAiScraper().run({
      fetchJson: async () => ({
        offset: 0,
        totalFound: 1,
        content: [{ ...indiaListing, company: { identifier: 'another-company' } }],
      }),
    }),
    /company identifier changed/i,
  )

  await assert.rejects(
    vernacularAi.createVernacularAiScraper().run({
      fetchJson: async (url) => {
        if (url.includes('/postings?')) return { offset: 0, totalFound: 1, content: [indiaListing] }
        return {
          ...indiaListing,
          postingUrl: 'https://third-party.example/jobs/111111',
          applyUrl: 'https://third-party.example/jobs/111111',
        }
      },
    }),
    /trusted public job url/i,
  )
})
