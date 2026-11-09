import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('../../scraper/knolskape/script.js')

const careersHtml = `
  <h1>Create. Learn. Grow.</h1>
  <h2>Explore Job Opportunities</h2>
  <a href="https://knolskape.keka.com/careers/jobdetails/73862">Read More</a>
  <a href="https://knolskape.keka.com/careers/applyjob/73862">Apply Now</a>
`

const portalInfo = {
  name: 'KNOLSKAPE',
  shortName: 'KNOLSKAPE',
  careersPortalDomain: 'knolskape.keka.com',
}

test('Knolskape maps only India jobs from its verified Keka board', async () => {
  const knolskape = await loadModule()
  const jobs = knolskape.extractSearchResults([
    {
      id: 73862,
      title: 'Senior Software Developer',
      description: '<p>Build backend systems.</p>',
      departmentName: 'Technology',
      jobLocations: [{ city: 'Bengaluru', state: 'Karnataka', countryCode: 'IN' }],
      jobType: 2,
      skillNames: ['Node.js'],
    },
    {
      id: 99999,
      title: 'International Role',
      jobLocations: [{ city: 'Singapore', countryCode: 'SG' }],
    },
  ])

  assert.deepEqual(jobs, [{
    title: 'Senior Software Developer',
    company: 'Knolskape',
    department: 'Technology',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    jobId: '73862',
    requisitionId: '73862',
    sourceUrl: 'https://knolskape.keka.com/careers/jobdetails/73862',
    applyUrl: 'https://knolskape.keka.com/careers/applyjob/73862',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Node.js'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build backend systems.',
  }])
})

test('Knolskape fails closed when the first-party handoff or Keka identity changes', async () => {
  const knolskape = await loadModule()

  await assert.rejects(
    knolskape.createKnolskapeScraper().run({
      fetchText: async () => '<html>Unverified careers page</html>',
      fetchJson: async () => portalInfo,
    }),
    /trusted first-party surface/i,
  )

  await assert.rejects(
    knolskape.createKnolskapeScraper().run({
      fetchText: async () => careersHtml,
      fetchJson: async (url) => url.includes('careerportalinfo')
        ? { ...portalInfo, name: 'Different Company' }
        : [],
    }),
    /exact company identity/i,
  )
})
