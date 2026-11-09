import assert from 'node:assert/strict'
import test from 'node:test'

const loadCywareModule = async () => import('../../scraper/cyware/script.js')

const careersPayload = {
  indiaJobs: {
    data: [
      {
        id: '848343000000589041',
        Posting_Title: 'Principal/Sr. Software Engineer',
        Job_Opening_Name: 'Principal/Sr. Software Engineer',
        City: 'Bengaluru',
        State: 'Karnataka',
        Country: 'India',
        Client_Name: { name: 'Engineering' },
        Job_Type: 'Full time',
        Work_Experience: '5+ years',
        Required_Skills: 'Kubernetes, Python, Go',
        Date_Opened: '2026-05-11',
        Created_Time: '2026-05-11T15:41:58+05:30',
        Remote_Job: false,
        Job_Description: 'Build cyber defense systems.',
      },
      {
        id: '848343000000589042',
        Posting_Title: 'US Security Researcher',
        City: 'Austin',
        Country: 'United States',
      },
    ],
  },
}

test('extractIndiaJobs maps Cyware first-party careers API records to India job listings', async () => {
  const { extractIndiaJobs } = await loadCywareModule()

  assert.deepEqual(extractIndiaJobs(careersPayload), [{
    title: 'Principal/Sr. Software Engineer',
    company: 'Cyware',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: '848343000000589041',
    requisitionId: '848343000000589041',
    sourceUrl: 'https://cyware.zohorecruit.com/jobs/Careers/848343000000589041/Principal-Sr-Software-Engineer?source=CareerSite',
    applyUrl: 'https://cyware.zohorecruit.com/jobs/Careers/848343000000589041/Principal-Sr-Software-Engineer?source=CareerSite',
    employmentType: 'Full-time',
    experienceRequired: '5+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Kubernetes', 'Python', 'Go'],
    postingDate: '2026-05-11',
    closingDate: null,
    jobDescription: 'Build cyber defense systems.',
    remoteStatus: 'On-site',
  }])
})

test('run fetches Cyware jobs from its first-party public careers endpoint', async () => {
  const { CAREERS_API_URL, createCywareScraper } = await loadCywareModule()
  const requests = []

  const jobs = await createCywareScraper().run({
    fetchJson: async (url) => {
      requests.push(url)
      return careersPayload
    },
  })

  assert.deepEqual(requests, [CAREERS_API_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'cyware')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})
