import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadWonksknowModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Wonksknow scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')
const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const overviewHtml = fs.readFileSync(path.join(fixturesDir, 'overview.html'), 'utf8')
const detailHtml = fs.readFileSync(path.join(fixturesDir, 'job-detail.html'), 'utf8')

test('Wonksknow scraper validates the verified homepage, official Vinterview overview, and public job detail surface', async () => {
  const wonksknow = await loadWonksknowModule()

  assert.equal(wonksknow.SOURCE, 'wonksknow')
  assert.equal(wonksknow.COMPANY, 'Wonksknow')
  assert.equal(wonksknow.HOMEPAGE_URL, 'https://www.wonksknow.com/')
  assert.equal(wonksknow.CAREERS_OVERVIEW_URL, 'https://vinterview.ai/wonksknowllc/overview')
  assert.equal(wonksknow.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(wonksknow.hasOfficialCareersOverviewSignal(overviewHtml), true)

  const listings = wonksknow.extractListings(overviewHtml, {
    headquarters: {
      city: 'Pleasanton',
      state: 'CA',
      country: 'USA',
      location: 'Pleasanton, CA, USA',
    },
  })
  assert.equal(listings.length, 1)
  assert.deepEqual(listings[0], {
    title: 'Appointment Setter - Education Sales (Part-Time)',
    location: 'Pleasanton, CA, USA',
    city: 'Pleasanton',
    state: 'CA',
    country: 'USA',
    employmentType: 'Part-time',
    sourceUrl: 'https://vinterview.ai/wonksknowllc/view_job_description?job_id=69d401e4940af941962e1f83',
    applyUrl: 'https://vinterview.ai/user/wonksknowllc/job_application_organization_page?job_id=69d401e4940af941962e1f83',
    jobId: '69d401e4940af941962e1f83',
  })

  const detail = wonksknow.extractJobDetail(detailHtml, listings[0])
  assert.equal(detail.title, 'Appointment Setter - Education Sales (Part-Time)')
  assert.equal(detail.location, 'Pleasanton, CA, USA')
  assert.equal(detail.employmentType, 'Part-time')
  assert.equal(detail.experienceRequired, '0-2 years')
  assert.equal(detail.remoteStatus, 'On-site')
  assert.match(detail.jobDescription, /WASC-accredited, CODiE Award-winning/i)
  assert.match(detail.minimumQualification, /Confident and professional on the phone/i)
  assert.deepEqual(detail.requiredSkills, [
    'Confident and professional on the phone with a clear, friendly speaking voice.',
    'Comfortable with cold calling and not discouraged by gatekeepers or voicemail.',
    'Organized and detail-oriented with strong follow-through on tasks.',
    'Familiar with or willing to learn about K-12 education, school administration and K-12 grants.',
    'Self-starter who can work independently during a focused calling block.',
    'Prior experience in outbound sales, appointment setting, telemarketing, or school/education outreach is a strong plus.',
    'Background in education, EdTech, or nonprofit outreach is a bonus but not required.',
  ])
})

test('Wonksknow scraper returns the official public jobs from the verified Vinterview handoff', async () => {
  const wonksknow = await loadWonksknowModule()
  const requestedUrls = []

  const jobs = await wonksknow.createWonksknowScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === wonksknow.HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === wonksknow.CAREERS_OVERVIEW_URL) {
        return overviewHtml
      }

      if (url === 'https://vinterview.ai/wonksknowllc/view_job_description?job_id=69d401e4940af941962e1f83') {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-13T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    wonksknow.HOMEPAGE_URL,
    wonksknow.CAREERS_OVERVIEW_URL,
    'https://vinterview.ai/wonksknowllc/view_job_description?job_id=69d401e4940af941962e1f83',
  ])

  assert.deepEqual(jobs, [
    {
      title: 'Appointment Setter - Education Sales (Part-Time)',
      company: 'Wonksknow',
      location: 'Pleasanton, CA, USA',
      city: 'Pleasanton',
      state: 'CA',
      country: 'USA',
      source: 'wonksknow',
      sourceUrl: 'https://vinterview.ai/wonksknowllc/view_job_description?job_id=69d401e4940af941962e1f83',
      applyUrl: 'https://vinterview.ai/user/wonksknowllc/job_application_organization_page?job_id=69d401e4940af941962e1f83',
      link: 'https://vinterview.ai/user/wonksknowllc/job_application_organization_page?job_id=69d401e4940af941962e1f83',
      companyCareerPage: 'https://vinterview.ai/wonksknowllc/overview',
      companyDomain: 'wonksknow.com',
      atsPlatform: 'Vinterview',
      jobId: '69d401e4940af941962e1f83',
      requisitionId: '69d401e4940af941962e1f83',
      employmentType: 'Part-time',
      experienceRequired: '0-2 years',
      remoteStatus: 'On-site',
      department: null,
      postingDate: null,
      closingDate: null,
      minimumQualification: 'Qualifications: Confident and professional on the phone with a clear, friendly speaking voice. Comfortable with cold calling and not discouraged by gatekeepers or voicemail. Organized and detail-oriented with strong follow-through on tasks. Familiar with or willing to learn about K-12 education, school administration and K-12 grants. Self-starter who can work independently during a focused calling block. Prior experience in outbound sales, appointment setting, telemarketing, or school/education outreach is a strong plus. Background in education, EdTech, or nonprofit outreach is a bonus but not required.',
      preferredQualification: null,
      requiredSkills: [
        'Confident and professional on the phone with a clear, friendly speaking voice.',
        'Comfortable with cold calling and not discouraged by gatekeepers or voicemail.',
        'Organized and detail-oriented with strong follow-through on tasks.',
        'Familiar with or willing to learn about K-12 education, school administration and K-12 grants.',
        'Self-starter who can work independently during a focused calling block.',
        'Prior experience in outbound sales, appointment setting, telemarketing, or school/education outreach is a strong plus.',
        'Background in education, EdTech, or nonprofit outreach is a bonus but not required.',
      ],
      jobDescription: 'Wonksknow has a WASC-accredited, CODiE Award-winning computer science education program that teaches real, industry-grade coding and robotics to students in grades 3 through 12. Our middle and high school students learn Python, Java, data structures, and AP Computer Science the way college freshmen do, taught by live instructors who know how to make rigorous content accessible. We are looking for a motivated and articulate Appointment Setter to join our Pleasanton office. You will be the first point of contact for schools and school districts across California and beyond, reaching out to CTE coordinators, curriculum directors, expanded learning program directors, and principals to introduce our program and set up meetings for our sales team. This is a phone-first role. You will be making 30-50 outbound calls per shift to school administrators on Tuesdays, Wednesdays, and Thursdays during the midday hours when they are most reachable. Responsibilities: Deliver a concise, compelling pitch that positions our program. Follow up on calls with personalized emails. Identify the right decision-maker at each district (CTE coordinator, curriculum director, after-school program director, or principal) and navigate to them. Log all activity, notes, and outcomes in our CRM and maintain an organized prospecting pipeline. Schedule discovery calls and demos between qualified prospects and the Wonksknow leadership team. Track and report on call volume, connection rates, and meetings booked weekly. Should be able to take the account from lead stage to signup. Lots of phone and email followups will be required. You must be willing to be on phone calls most of the time with the goal of explaining and selling company\'s products and services. You must be able to create a consultive conversation in a short time and present solutions that meet the potential customers\' needs. The ideal candidate will also be patient and cool-tempered to deal with rejection. Follow up with prospective customers who have shown any signals of being interested in the products and services offered by the company.',
      scrapedAt: '2026-07-13T00:00:00.000Z',
    },
  ])
})

test('Wonksknow scraper fails closed when the homepage, overview, or public job detail surface drifts', async () => {
  const wonksknow = await loadWonksknowModule()

  await assert.rejects(
    wonksknow.createWonksknowScraper().run({
      fetchText: async (url) => {
        if (url === wonksknow.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body></body></html>'
        }

        if (url === wonksknow.CAREERS_OVERVIEW_URL) {
          return overviewHtml
        }

        return detailHtml
      },
    }),
    /official Wonksknow homepage/i,
  )

  await assert.rejects(
    wonksknow.createWonksknowScraper().run({
      fetchText: async (url) => {
        if (url === wonksknow.HOMEPAGE_URL) {
          return homepageHtml
        }

        if (url === wonksknow.CAREERS_OVERVIEW_URL) {
          return overviewHtml.replace('Apply here', 'Learn more')
        }

        return detailHtml
      },
    }),
    /careers overview|listing surface/i,
  )

  await assert.rejects(
    wonksknow.createWonksknowScraper().run({
      fetchText: async (url) => {
        if (url === wonksknow.HOMEPAGE_URL) {
          return homepageHtml
        }

        if (url === wonksknow.CAREERS_OVERVIEW_URL) {
          return overviewHtml
        }

        return detailHtml.replace('APPLY FOR THIS JOB', 'CONTACT US')
      },
    }),
    /job detail surface/i,
  )
})
