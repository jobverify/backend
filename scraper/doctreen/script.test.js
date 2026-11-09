import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  PAGES_SITEMAP_URL,
  createDoctreenScraper,
  extractCareerJobs,
} from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const careersHtml = `
  <main>
    <h1>Nous rejoindre</h1>
    <section>
      <h2>Nous recherchons activement ces profils</h2>
      <ul>
        <li>Developpeur Full Stack</li>
        <li>Ingenieur DevSecOps</li>
      </ul>
    </section>
    <section>
      <h2>Envie de rejoindre l'aventure Doctreen ?</h2>
      <p>J'envoie ma candidature</p>
    </section>
  </main>
`

const accordionCareersHtml = `
  <main>
    <section>
      <h2>Nous recherchons activement<br> ces profils</h2>
      <ul class="wixui-accordion" role="list">
        <li class="wixui-accordion__item">
          <div>
            <button type="button" aria-controls="job-1">
              <span class="wixui-accordion__title">Développeur Full Stack</span>
              <span aria-hidden="true"><svg></svg></span>
            </button>
          </div>
          <div id="job-1">
            <ul>
              <li>Conception full stack</li>
              <li>Déploiement cloud</li>
            </ul>
            <a href="https://www.doctreen.com/carrieres">Je postule</a>
          </div>
        </li>
        <li class="wixui-accordion__item">
          <div>
            <button type="button" aria-controls="job-2">
              <span class="wixui-accordion__title">Ingénieur DevSecOps</span>
              <span aria-hidden="true"><svg></svg></span>
            </button>
          </div>
          <div id="job-2">
            <ul>
              <li>Automatisation</li>
            </ul>
            <a href="https://www.doctreen.com/carrieres">Je postule</a>
          </div>
        </li>
      </ul>
    </section>
    <section>
      <h2>Envie de rejoindre l&rsquo;aventure Doctreen ?<br> Écrivez-nous quelques mots, on a hâte de vous lire !</h2>
      <a href="mailto:contact@doctreen.com?subject=Je%20candidate%20pour%20Doctreen">J&#x27;envoie ma candidature</a>
    </section>
  </main>
`

test('extractCareerJobs maps Doctreen career roles from the official careers section', () => {
  assert.deepEqual(extractCareerJobs(careersHtml), [
    {
      title: 'Developpeur Full Stack',
      company: 'Doctreen',
      department: null,
      location: 'France',
      city: null,
      country: 'France',
      jobId: 'developpeur-full-stack',
      requisitionId: 'developpeur-full-stack',
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: CAREER_PAGE_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Ingenieur DevSecOps',
      company: 'Doctreen',
      department: null,
      location: 'France',
      city: null,
      country: 'France',
      jobId: 'ingenieur-devsecops',
      requisitionId: 'ingenieur-devsecops',
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: CAREER_PAGE_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official Doctreen careers page shape before returning jobs', async () => {
  const scraper = createDoctreenScraper()
  const requests = []
  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requests, [CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'doctreen')
  assert.equal(jobs[0].link, CAREER_PAGE_URL)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('extractCareerJobs supports the current Doctreen accordion openings layout', () => {
  assert.deepEqual(extractCareerJobs(accordionCareersHtml), [
    {
      title: 'Développeur Full Stack',
      company: 'Doctreen',
      department: null,
      location: 'France',
      city: null,
      country: 'France',
      jobId: 'developpeur-full-stack',
      requisitionId: 'developpeur-full-stack',
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: CAREER_PAGE_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Ingénieur DevSecOps',
      company: 'Doctreen',
      department: null,
      location: 'France',
      city: null,
      country: 'France',
      jobId: 'ingenieur-devsecops',
      requisitionId: 'ingenieur-devsecops',
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: CAREER_PAGE_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('rejects a Doctreen careers page without the expected openings section', () => {
  assert.throws(
    () => extractCareerJobs('<main><h1>Nous rejoindre</h1></main>'),
    /expected openings page shape/,
  )
})

test('records verified empty inventory when the retired careers route resolves to the current About page and sitemap', async () => {
  const requested = []
  const jobs = await createDoctreenScraper().run({
    fetchText: async url => {
      requested.push(url)
      if (url === CAREER_PAGE_URL) return '<html><head><title>À propos — Doctreen</title><link rel="canonical" href="https://www.doctreen.com/a-propos"></head><body>Doctreen Montpellier</body></html>'
      if (url === PAGES_SITEMAP_URL) return '<urlset><url><loc>https://www.doctreen.com/</loc></url><url><loc>https://www.doctreen.com/a-propos</loc></url></urlset>'
      throw new Error(`Unexpected URL: ${url}`)
    },
  })
  assert.deepEqual(requested, [CAREER_PAGE_URL, PAGES_SITEMAP_URL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
})

test('rejects a sitemap with a live careers page', async () => {
  await assert.rejects(createDoctreenScraper().run({
    fetchText: async url => url === CAREER_PAGE_URL
      ? '<html><head><title>À propos — Doctreen</title><link href="https://www.doctreen.com/a-propos"></head><body>Montpellier</body></html>'
      : '<urlset><url><loc>https://www.doctreen.com/a-propos</loc></url><url><loc>https://www.doctreen.com/carrieres</loc></url></urlset>',
  }), /sitemap no longer proves/i)
})
