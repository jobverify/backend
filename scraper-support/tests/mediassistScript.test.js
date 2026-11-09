import assert from 'node:assert/strict'
import test from 'node:test'

const loadMediAssistModule = async () => {
  try {
    return await import('../../scraper/mediassist/script.js')
  } catch {
    assert.fail('Expected Medi Assist scraper module at ../../scraper/mediassist/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Medi Assist</title>
    <link data-n-head="ssr" href="https://mediassist.in/careers/" rel="canonical" />
  </head>
  <body>
    <main>
      <div id="jobs-at-medi-assist">
        <h2>Jobs at Medi Assist</h2>
        <div class="mb-2 bg-[#f6f6f6] p-6 rounded-2xl">
          <a href="/career/product-manager/" class="block text-base md:text-xl leading-6 font-semibold mb-2 !text-left">Product Manager</a>
          <div><a href="/career/product-manager/" class="inline-block">Read more</a></div>
        </div>
        <div class="mb-2 bg-[#f6f6f6] p-6 rounded-2xl">
          <a href="/career/medical-officer/" class="block text-base md:text-xl leading-6 font-semibold mb-2 !text-left">Medical Officer</a>
          <div><a href="/career/medical-officer/" class="inline-block">Read more</a></div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const productManagerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="Product Manager">
    <title>Product Manager</title>
  </head>
  <body>
    <main>
      <h1 class="!text-4xl lg:text-6xl !leading-tight !font-normal">Product Manager</h1>
      <div class="max-w-screen-sm mx-auto">
        <div class="mb-6 pb-6 border-b border-solid border-gray-300">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-4 mb-4 -ml-1">
            <div class="flex items-center gap-1"><p>Bangalore</p></div>
            <div class="flex items-center gap-1"><p>2+ years</p></div>
            <div class="flex items-center gap-1"><p>Any graduate</p></div>
          </div>
          <div>
            <a target="_blank" href="/cdn-cgi/l/email-protection#6115000d040f15210c0405080012120812154f080f" class="inline-block px-4 py-1 text-base text-white border primaryBordercolor primaryBgColor rounded">Apply now</a>
            <span class="text-sm">or send your resume to <a href="/cdn-cgi/l/email-protection#6115000d040f15210c0405080012120812154f080f"><span class="__cf_email__" data-cfemail="6115000d040f15210c0405080012120812154f080f">[email&#160;protected]</span></a></span>
          </div>
        </div>
        <div class="nuxt-content">
          <h3 id="role-overview">Role Overview:</h3>
          <p>We are seeking a Product Manager to oversee key modules of our MAtrix claims processing platform.</p>
        </div>
      </div>
    </main>
  </body>
</html>
`

const medicalOfficerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="Medical Officer">
    <title>Medical Officer</title>
  </head>
  <body>
    <main>
      <h1 class="!text-4xl lg:text-6xl !leading-tight !font-normal">Medical Officer</h1>
      <div class="max-w-screen-sm mx-auto">
        <div class="mb-6 pb-6 border-b border-solid border-gray-300">
          <div class="flex flex-wrap items-center gap-x-6 gap-y-4 mb-4 -ml-1">
            <div class="flex items-center gap-1"><p>Bangalore/ Mumbai/ Noida</p></div>
            <div class="flex items-center gap-1"><p>0 – 3 years</p></div>
            <div class="flex items-center gap-1"><p>BAMS, BHMS, B Sc. Nursing &amp; MBBS (India Reg Mandatory)</p></div>
          </div>
          <div>
            <a target="_blank" href="/cdn-cgi/l/email-protection#6115000d040f15210c0405080012120812154f080f" class="inline-block px-4 py-1 text-base text-white border primaryBordercolor primaryBgColor rounded">Apply now</a>
            <span class="text-sm">or send your resume to <a href="/cdn-cgi/l/email-protection#6115000d040f15210c0405080012120812154f080f"><span class="__cf_email__" data-cfemail="6115000d040f15210c0405080012120812154f080f">[email&#160;protected]</span></a></span>
          </div>
        </div>
        <div class="nuxt-content">
          <h3 id="purpose-of-role">Purpose of role:</h3>
          <p>To scrutinize and process the claims within the agreed TAT.</p>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('extractOpenings reads the verified Medi Assist careers page cards', async () => {
  const mediassist = await loadMediAssistModule()

  assert.equal(mediassist.SOURCE, 'mediassist')
  assert.equal(mediassist.COMPANY, 'Medi Assist Insurance TPA Pvt. Ltd.')
  assert.equal(mediassist.CAREERS_URL, 'https://www.mediassist.in/careers/')
  assert.deepEqual(mediassist.extractOpenings(careersHtml), [
    {
      title: 'Product Manager',
      sourceUrl: 'https://www.mediassist.in/career/product-manager/',
    },
    {
      title: 'Medical Officer',
      sourceUrl: 'https://www.mediassist.in/career/medical-officer/',
    },
  ])
})

test('extractJobDetail parses the verified Medi Assist product manager detail page', async () => {
  const mediassist = await loadMediAssistModule()

  assert.deepEqual(
    mediassist.extractJobDetail(
      productManagerHtml,
      'https://www.mediassist.in/career/product-manager/',
    ),
    {
      title: 'Product Manager',
      location: 'Bangalore',
      city: 'Bangalore',
      experienceRequired: '2+ years',
      minimumQualification: 'Any graduate',
      jobDescription: 'Role Overview: We are seeking a Product Manager to oversee key modules of our MAtrix claims processing platform.',
      sourceUrl: 'https://www.mediassist.in/career/product-manager/',
      applyUrl: 'mailto:talent@mediassist.in',
      jobId: 'product-manager',
      requisitionId: 'product-manager',
    },
  )
})

test('run fetches the verified Medi Assist careers page and detail pages', async () => {
  const mediassist = await loadMediAssistModule()
  const requestedUrls = []

  const jobs = await mediassist.createMediAssistScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://www.mediassist.in/careers/') return careersHtml
      if (url === 'https://www.mediassist.in/career/product-manager/') return productManagerHtml
      if (url === 'https://www.mediassist.in/career/medical-officer/') return medicalOfficerHtml
      throw new Error(`Unexpected Medi Assist fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.mediassist.in/careers/',
    'https://www.mediassist.in/career/product-manager/',
    'https://www.mediassist.in/career/medical-officer/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      company: job.company,
      source: job.source,
      link: job.link,
      location: job.location,
    })),
    [
      {
        title: 'Product Manager',
        company: 'Medi Assist Insurance TPA Pvt. Ltd.',
        source: 'mediassist',
        link: 'mailto:talent@mediassist.in',
        location: 'Bangalore',
      },
      {
        title: 'Medical Officer',
        company: 'Medi Assist Insurance TPA Pvt. Ltd.',
        source: 'mediassist',
        link: 'mailto:talent@mediassist.in',
        location: 'Bangalore/ Mumbai/ Noida',
      },
    ],
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
