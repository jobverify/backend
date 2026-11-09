import assert from 'node:assert/strict'
import test from 'node:test'

import { createAnandEngineeringProductsScraper } from '../../scraper/anandengineeringproductspvtltd/script.js'

const home = `<html><head><title>Anand Engineering | Heavy Steel Fabrication &amp; Manufacturing</title></head><body><a href="https://anandengg.in/open-positions/">Careers</a><p>D56, Developed Plot Estate, Thuvakudi, Trichy</p><a href="mailto:admin@anandengg.in">Email</a></body></html>`
const card = (id, title, slug) => `<div data-elementor-type="loop-item" class="elementor e-loop-item post-${id} job-opening type-job-opening status-publish"><h1>${title}</h1><span>August 29, 2026</span><span>5-8 Years</span><a href="https://anandengg.in/job-opening/${slug}/">Apply</a></div>`
const listing = (page, maxPage, cards) => `<html><head><title>Open Positions - Anand Engineering</title><link rel="canonical" href="https://anandengg.in/open-positions/" /></head><body>${cards}<div class="e-load-more-anchor" data-page="${page}" data-max-page="${maxPage}" data-next-page="https://anandengg.in/open-positions/${page + 1}/"></div></body></html>`
const detail = (title, slug) => `<html><head><title>${title} - Anand Engineering</title><link rel="canonical" href="https://anandengg.in/job-opening/${slug}/" /></head><body><h1>${title}</h1><div><h3><strong>Job Description</strong></h3><p>Build manufacturing processes and improve quality.</p><p><strong>Job Experience :</strong> 5 &#8211; 8 yrs</p></div><form name="Career Form"><h5>Application Form</h5></form></body></html>`

test('Anand Engineering Products follows verified first-party pagination and job applications', async () => {
  const pages = new Map([
    ['https://anandengg.in/', home],
    ['https://anandengg.in/open-positions/', listing(1, 2, card('991698', 'Executive/Senior Executive &#8211; Finance', 'executive-senior-executive-finance'))],
    ['https://anandengg.in/open-positions/2/', listing(2, 2, card('991689', 'Executive / Senior Executive HR', 'executive-senior-executive-hr'))],
    ['https://anandengg.in/job-opening/executive-senior-executive-finance/', detail('Executive/Senior Executive &#8211; Finance', 'executive-senior-executive-finance')],
    ['https://anandengg.in/job-opening/executive-senior-executive-hr/', detail('Executive / Senior Executive HR', 'executive-senior-executive-hr').replace('<h3><strong>Job Description</strong></h3>', '<h3 class="product-title">Job Description</h3><h4>Role &amp; responsibilities</h4>')],
  ])
  const requested = []
  const jobs = await createAnandEngineeringProductsScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      assert.ok(pages.has(url), `Unexpected request ${url}`)
      return pages.get(url)
    },
  })
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map(({ jobId, title, postingDate }) => [jobId, title, postingDate]), [
    ['991698', 'Executive/Senior Executive – Finance', '2026-08-29'],
    ['991689', 'Executive / Senior Executive HR', '2026-08-29'],
  ])
  assert.ok(jobs.every((job) => job.source === 'anandengineeringproductspvtltd' && job.link === job.applyUrl && job.jobDescription.includes('Build manufacturing processes')))
  assert.deepEqual(requested, [...pages.keys()])
})

test('Anand Engineering Products rejects a changed homepage or off-domain listing', async () => {
  await assert.rejects(createAnandEngineeringProductsScraper().run({ fetchText: async () => '<title>anandengineeringproducts.com</title>' }), /homepage/i)
  await assert.rejects(createAnandEngineeringProductsScraper().run({
    fetchText: async (url) => url === 'https://anandengg.in/' ? home : listing(1, 1, card('1', 'Wrong', 'wrong').replace('https://anandengg.in/job-opening/', 'https://other.example/job-opening/')),
  }), /listing|job link|first-party/i)
})
