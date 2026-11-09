import assert from 'node:assert/strict'
import test from 'node:test'

const careersPage = {
  status: 200,
  url: 'https://innefu.com/careers/',
  html: `
    <title>Careers Archive - Innefu Labs</title>
    <h1>Current Job Openings</h1>
    <a href="/career/technical-architect/">Technical Architect</a>
    <a href="/career/project-manager/">Technical Project Manager</a>
    <p>Write to us at jobs@innefu.com</p>
  `,
}

const technicalArchitectPage = {
  status: 200,
  url: 'https://innefu.com/career/technical-architect/',
  html: `
    <h1>Technical Architect</h1>
    <div>Delhi</div><div>12+ Years</div>
    <h2>Job Description</h2><p>Lead secure, scalable system architectures.</p>
    <h2>Join Us</h2><p>jobs@innefu.com</p>
  `,
}

test('Innefu Labs extracts India roles from its verified first-party careers pages', async () => {
  const innefu = await import('../../scraper/innefulabs/script.js')

  assert.equal(innefu.hasOfficialCareersPageSignal(careersPage), true)
  assert.deepEqual(innefu.extractJobLinks(careersPage.html), [
    'https://innefu.com/career/technical-architect/',
    'https://innefu.com/career/project-manager/',
  ])

  const singleJobCareersPage = {
    ...careersPage,
    html: careersPage.html.replace('    <a href="/career/project-manager/">Technical Project Manager</a>\n', ''),
  }
  const jobs = await innefu.createInnefuLabsScraper().run({
    fetchPage: async (url) => url === innefu.CAREERS_PAGE_URL
      ? singleJobCareersPage
      : technicalArchitectPage,
  })

  assert.deepEqual(jobs, [{
    title: 'Technical Architect',
    company: 'Innefu Labs',
    department: null,
    location: 'Delhi, India',
    city: 'Delhi',
    country: 'India',
    jobId: 'technical-architect',
    requisitionId: 'technical-architect',
    sourceUrl: 'https://innefu.com/career/technical-architect/',
    applyUrl: 'mailto:jobs@innefu.com',
    employmentType: null,
    experienceRequired: '12+ Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead secure, scalable system architectures.',
    remoteStatus: null,
    source: 'innefulabs',
    link: 'mailto:jobs@innefu.com',
  }])
})

test('Innefu Labs fails closed when the first-party careers invariant changes', async () => {
  const innefu = await import('../../scraper/innefulabs/script.js')

  await assert.rejects(
    innefu.createInnefuLabsScraper().run({
      fetchPage: async () => ({ ...careersPage, html: '<h1>Careers</h1>' }),
    }),
    /verified first-party careers page/i,
  )
})
