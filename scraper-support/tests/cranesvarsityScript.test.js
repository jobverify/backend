import assert from 'node:assert/strict'
import test from 'node:test'

const loadCranesVarsityModule = async () => {
  try {
    return await import('../../scraper/cranesvarsity/script.js')
  } catch {
    return null
  }
}

const buildJob = ({
  id,
  dateGmt,
  title,
  slug,
  description,
}) => ({
  id,
  date_gmt: dateGmt,
  link: `https://cranesvarsity.com/jobs/${slug}/`,
  title: { rendered: title },
  content: { rendered: `<p>${description}</p>` },
})

test('extractSearchResults maps Cranes Varsity public WordPress jobs into shared scraper fields', async () => {
  const cranesVarsity = await loadCranesVarsityModule()
  assert.ok(cranesVarsity)

  const jobs = cranesVarsity.extractSearchResults([
    buildJob({
      id: 35160,
      dateGmt: '2026-04-22T06:17:35',
      title: 'Academic Counsellor',
      slug: 'academic-counsellor-2',
      description: 'Guide students through career and placement opportunities.',
    }),
    buildJob({
      id: 35140,
      dateGmt: '2026-04-22T05:46:56',
      title: 'INSIDE SALES &#8211; INTERNS',
      slug: 'inside-sales-interns-3',
      description: 'Support the inside sales team.',
    }),
  ])

  assert.deepEqual(jobs[0], {
    title: 'Academic Counsellor',
    company: 'Cranes Varsity',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '35160',
    requisitionId: '35160',
    sourceUrl: 'https://cranesvarsity.com/jobs/academic-counsellor-2/',
    applyUrl: 'https://cranesvarsity.com/jobs/academic-counsellor-2/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-04-22T06:17:35.000Z',
    closingDate: null,
    jobDescription: 'Guide students through career and placement opportunities.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].title, 'INSIDE SALES - INTERNS')
  assert.equal(jobs[1].jobId, '35140')
})

test('run follows the official Cranes Varsity REST pages until a short page is returned', async () => {
  const cranesVarsity = await loadCranesVarsityModule()
  assert.ok(cranesVarsity)

  const requestedUrls = []
  const scraper = cranesVarsity.createCranesVarsityScraper()
  const firstPage = Array.from({ length: 10 }, (_, index) => buildJob({
    id: 35160 - index,
    dateGmt: '2026-04-22T06:17:35',
    title: `Role ${index + 1}`,
    slug: `role-${index + 1}`,
    description: `Role ${index + 1} description`,
  }))
  const secondPage = [buildJob({
    id: 35140,
    dateGmt: '2026-04-22T05:46:56',
    title: 'Final Role',
    slug: 'final-role',
    description: 'The final page is shorter than the public page size.',
  })]

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === cranesVarsity.buildSearchUrl(1)) return firstPage
      if (url === cranesVarsity.buildSearchUrl(2)) return secondPage
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cranesVarsity.buildSearchUrl(1),
    cranesVarsity.buildSearchUrl(2),
  ])
  assert.equal(jobs.length, 11)
  assert.equal(jobs[0].source, 'cranesvarsity')
  assert.equal(jobs[0].link, 'https://cranesvarsity.com/jobs/role-1/')
  assert.equal(jobs[0].company, 'Cranes Varsity')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
