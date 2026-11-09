import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-26T00:00:00.000Z'

const staticCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Setu | Join Our Fintech Team</title>
  </head>
  <body>
    <main>
      <h1>Come tackle India's toughest fintech problems with an exceptional set of people.</h1>
      <p>We are completely overhauling our country's dated fintech architecture.</p>
      <h2>Current openings</h2>
      <p>Fetching open roles...</p>
      <footer>(c) 2026 BrokenTusk Technologies Pvt. Ltd</footer>
    </main>
  </body>
</html>
`

const currentFramerCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Setu — Fintech Jobs in India</title>
    <meta name="description" content="Open roles at Setu. Build the financial infrastructure that powers India's payments, verification and credit.">
    <link rel="canonical" href="https://setu.co/careers">
  </head>
  <body>
    <h1>Come work with us</h1>
    <p>Help us build the financial infrastructure India runs on.</p>
    <h2>Open roles</h2>
    <p>Every role links straight through to our application portal.</p>
    <section data-framer-name="CUSTOMER SUCCESS">
      <a name="Manager - Customer Success" href="https://pinelabsgroup.turbohire.co/get/bG9zTFJ">
        <h3>Manager - Customer Success</h3>
        <p>Customer Success</p>
        <p>Apply</p>
      </a>
      <a name="Manager - Customer Success" href="https://pinelabsgroup.turbohire.co/get/bG9zTFJ">
        <h3>Manager - Customer Success</h3>
        <p>Customer Success</p>
        <p>Apply</p>
      </a>
    </section>
  </body>
</html>
`

const currentOpeningsCsv = `Role,Description,Link,Category,Sub-category
SDE - II Fullstack Engineer,https://docs.google.com/document/d/fullstack/edit,https://pinelabsgroup.turbohire.co/get/RFZUclV,Engineering,Payments
SDE - II Backend Engineer,https://docs.google.com/document/d/backend/edit,https://pinelabsgroup.turbohire.co/get/bGFRMGN,Engineering,Payments
Data Engineer,https://drive.google.com/file/d/data/view,https://pinelabsgroup.turbohire.co/get/aDFnNUx,Engineering,Data
`

const categoryDescriptionsCsv = `Category,Description
Engineering,"Engineering the structural system, the payload, the guidance, and the propulsion systems to build a financial rocketship at Setu."
Payments,Build core infrastructure to enable payments to businesses.
Data,Enable a solution for businesses to analyse financial data of customers.
`

const detailHtmlWithExperience = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="[Hiring For]: SDE I (DT_209)">
    <meta
      property="og:description"
      content="Full Stack Engineer (Frontend-heavy, SDE2)Experience : 2-4 YearsAbout SetuIndia’s economic infrastructure needs a complete overhaul."
    >
  </head>
  <body></body>
</html>
`

const detailHtmlWithoutExperience = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="[Hiring For]: Manager (DT_4)">
    <meta
      property="og:description"
      content="About Setu Importance of the role To know more - Click on View full description"
    >
  </head>
  <body></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/setu/script.js')
  } catch {
    assert.fail('Expected Setu scraper module at ../../scraper/setu/script.js')
  }
}

test('Setu helpers stay pinned to the verified official careers shell and CSV-backed openings contract', async () => {
  const setu = await loadModule()

  assert.equal(setu.SOURCE, 'setu')
  assert.equal(setu.COMPANY_NAME, 'Setu')
  assert.equal(setu.OFFICIAL_BRAND_NAME, 'BrokenTusk Technologies Pvt. Ltd.')
  assert.equal(setu.VERIFIED_ON, '2026-09-13')
  assert.equal(setu.CAREERS_URL, 'https://setu.co/careers/')
  assert.equal(
    setu.CURRENT_OPENINGS_CSV_URL,
    'https://raw.githubusercontent.com/SetuHQ/website-content/refs/heads/main/careers/Setu%20Website%20-%20CurrentOpenings.csv',
  )
  assert.equal(
    setu.CATEGORY_DESCRIPTIONS_CSV_URL,
    'https://raw.githubusercontent.com/SetuHQ/website-content/refs/heads/main/careers/Setu%20Website%20-%20CategoryDescriptions.csv',
  )
  assert.equal(setu.hasOfficialCareersSignal(staticCareersHtml), true)
  assert.equal(setu.hasPlaceholderOpeningsSignal(staticCareersHtml), true)
  assert.equal(setu.hasCurrentOpeningsCsvSignal(currentOpeningsCsv), true)
  assert.equal(setu.hasCategoryDescriptionsCsvSignal(categoryDescriptionsCsv), true)
  assert.deepEqual(setu.extractJobsFromCsv(currentOpeningsCsv, categoryDescriptionsCsv), [
    {
      jobId: 'RFZUclV',
      title: 'SDE - II Fullstack Engineer',
      department: 'Engineering',
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://pinelabsgroup.turbohire.co/get/RFZUclV',
      applyUrl: 'https://pinelabsgroup.turbohire.co/get/RFZUclV',
      jobDescription: 'Build core infrastructure to enable payments to businesses.',
    },
    {
      jobId: 'bGFRMGN',
      title: 'SDE - II Backend Engineer',
      department: 'Engineering',
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://pinelabsgroup.turbohire.co/get/bGFRMGN',
      applyUrl: 'https://pinelabsgroup.turbohire.co/get/bGFRMGN',
      jobDescription: 'Build core infrastructure to enable payments to businesses.',
    },
    {
      jobId: 'aDFnNUx',
      title: 'Data Engineer',
      department: 'Engineering',
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://pinelabsgroup.turbohire.co/get/aDFnNUx',
      applyUrl: 'https://pinelabsgroup.turbohire.co/get/aDFnNUx',
      jobDescription: 'Enable a solution for businesses to analyse financial data of customers.',
    },
  ])
})

test('Setu detail enrichment recovers public experience from TurboHire metadata and marks verified missing pages as checked', async () => {
  const setu = await loadModule()

  const withExperience = setu.enrichSetuJobFromDetailPage({
    title: 'SDE - II Fullstack Engineer',
    jobDescription: 'Build core infrastructure to enable payments to businesses.',
    experienceRequired: null,
  }, detailHtmlWithExperience)

  assert.equal(withExperience.experienceRequired, '2-4 years')
  assert.equal(withExperience.publicExperienceChecked, true)
  assert.match(withExperience.jobDescription, /2-4 Years/i)

  const verifiedMissing = setu.enrichSetuJobFromDetailPage({
    title: 'Senior Manager - Enterprise Sales',
    jobDescription: null,
    experienceRequired: null,
  }, detailHtmlWithoutExperience)

  assert.equal(verifiedMissing.experienceRequired, null)
  assert.equal(verifiedMissing.publicExperienceChecked, true)
  assert.match(verifiedMissing.jobDescription, /About Setu/i)
})

test('Setu reads only the roles exposed by the current first-party Framer careers page', async () => {
  const setu = await loadModule()

  assert.equal(setu.hasOfficialCareersSignal(currentFramerCareersHtml), true)
  assert.deepEqual(setu.extractCurrentCareersJobs(currentFramerCareersHtml), [
    {
      jobId: 'bG9zTFJ',
      title: 'Manager - Customer Success',
      department: 'Customer Success',
      location: 'India',
      city: null,
      country: 'India',
      sourceUrl: 'https://pinelabsgroup.turbohire.co/get/bG9zTFJ',
      applyUrl: 'https://pinelabsgroup.turbohire.co/get/bG9zTFJ',
      jobDescription: null,
    },
  ])

  const requestedUrls = []
  const jobs = await setu.createSetuScraper({ now: () => FIXED_SCRAPED_AT }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === setu.CAREERS_URL) return currentFramerCareersHtml
      if (url === 'https://pinelabsgroup.turbohire.co/get/bG9zTFJ') return detailHtmlWithoutExperience
      throw new Error(`Unexpected Setu URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    setu.CAREERS_URL,
    'https://pinelabsgroup.turbohire.co/get/bG9zTFJ',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Manager - Customer Success')
})

test('Setu run validates the official careers page and extracts openings from the verified CSV contract', async () => {
  const setu = await loadModule()
  const requestedTexts = []

  const jobs = await setu.createSetuScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === setu.CAREERS_URL) return staticCareersHtml
      if (url === setu.CURRENT_OPENINGS_CSV_URL) return currentOpeningsCsv
      if (url === setu.CATEGORY_DESCRIPTIONS_CSV_URL) return categoryDescriptionsCsv
      if (url === 'https://pinelabsgroup.turbohire.co/get/RFZUclV') return detailHtmlWithExperience
      if (url === 'https://pinelabsgroup.turbohire.co/get/bGFRMGN') return detailHtmlWithoutExperience
      if (url === 'https://pinelabsgroup.turbohire.co/get/aDFnNUx') {
        throw new Error('HTTP 404 for https://pinelabsgroup.turbohire.co/get/aDFnNUx')
      }
      throw new Error(`Unexpected Setu URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [
    setu.CAREERS_URL,
    setu.CURRENT_OPENINGS_CSV_URL,
    setu.CATEGORY_DESCRIPTIONS_CSV_URL,
    'https://pinelabsgroup.turbohire.co/get/RFZUclV',
    'https://pinelabsgroup.turbohire.co/get/bGFRMGN',
    'https://pinelabsgroup.turbohire.co/get/aDFnNUx',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, 'SDE - II Fullstack Engineer')
  assert.equal(jobs[0].experienceRequired, '2-4 years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.match(jobs[0].jobDescription, /2-4 Years/i)
  assert.equal(jobs[1].title, 'SDE - II Backend Engineer')
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[2].title, 'Data Engineer')
  assert.equal(jobs[2].jobDescription, 'Enable a solution for businesses to analyse financial data of customers.')
  assert.equal(jobs[2].publicExperienceChecked, true)
})

test('Setu fails closed when the official careers shell or verified CSV contracts drift materially', async () => {
  const setu = await loadModule()

  await assert.rejects(
    setu.createSetuScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified setu careers page/i,
  )

  await assert.rejects(
    setu.createSetuScraper().run({
      fetchText: async (url) => {
        if (url === setu.CAREERS_URL) return staticCareersHtml
        if (url === setu.CURRENT_OPENINGS_CSV_URL) return 'Role,Link\nBroken\n'
        return categoryDescriptionsCsv
      },
    }),
    /current openings csv/i,
  )

  await assert.rejects(
    setu.createSetuScraper().run({
      fetchText: async (url) => {
        if (url === setu.CAREERS_URL) return staticCareersHtml
        if (url === setu.CURRENT_OPENINGS_CSV_URL) return currentOpeningsCsv
        return 'Category,Description\nProduct,\n'
      },
    }),
    /category descriptions csv/i,
  )
})
