import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Technotreon: The Innovation Company</title>
  </head>
  <body>
    <nav>
      <a href="/">HOME</a>
      <a href="/careers">CAREERS</a>
    </nav>
    <h1>TECHNOTREON: THE INNOVATION COMPANY</h1>
    <p>We invent, patent, and commercialize breakthrough technologies.</p>
    <p>At Technotreon, we invent the next big thing, driving innovation for a Viksit Bharat.</p>
    <footer>research[at]technotreon[dot]in</footer>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html>
  <head>
    <title>CAREERS</title>
  </head>
  <body>
    <nav>
      <a href="/">HOME</a>
      <a href="/careers">CAREERS</a>
    </nav>
    <h1>Although we aren't sailing for the Antarctic (yet), our job description remains the same as Ernest Shackleton's.</h1>
    <p>Open call for all humans who are not machines, who come with a spirit to learn and grow, and those with an innate ability to innovate.</p>
    <h2>DEPARTMENTS AT TECHNOTREON</h2>

    <h2>Business and Marketing Standardised Aptitude Test</h2>
    <p>Join our dynamic team as a Business Rockstar! Drive brand awareness, execute innovative campaigns, analyze market trends, and unleash your creativity to captivate audiences. Collaborate with cross-functional teams to drive transformative ideas and shape our future. #BrandInnovator</p>
    <a href="https://forms.gle/business-role">Apply</a>

    <h2>Intellectual Property (Legal) STANDARDISED Aptitude Test</h2>
    <p>Step into the world of intellectual property and legal innovation. You will work on patents, legal research, and IP strategy to protect and strengthen cutting-edge ideas.</p>
    <p>Gain hands-on experience in real-world legal challenges, contributing to innovation, compliance, and strategic decision-making.</p>
    <a href="https://forms.gle/legal-role">Apply</a>

    <h2>Engineering STANDARDISED Aptitude Test</h2>
    <p>Immerse yourself in cutting-edge innovation research and discover new horizons. We're seeking passionate individuals to pioneer electronic design innovation. Work alongside diverse teams to catalyze groundbreaking ideas and mould our future. Be part of the driving force behind the next major breakthrough!</p>
    <a href="https://forms.gle/engineering-role">Apply</a>

    <h2>HR Assistant STANDARDISED Aptitude Test</h2>
    <p>Step into people management and organizational growth. As an HR Assistant, you will support recruitment, employee engagement, and HR operations while contributing to a positive workplace culture.</p>
    <p>Work with dynamic teams and gain hands-on experience in HR processes, helping drive organizational success.</p>
    <a href="https://forms.gle/hr-role">Apply</a>

    <section>
      <h2>The Only Room Where Inventors, Engineers & IP Lawyers Build</h2>
      <p>Most companies hire you to maintain someone else's old code or product. At Technotreon, we build things from scratch that have never existed before.</p>
    </section>
  </body>
</html>
`

const loadTechnotreonModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Technotreon scraper module at ./script.js')
  }
}

test('Technotreon scraper constants stay pinned to the verified first-party surface', async () => {
  const technotreon = await loadTechnotreonModule()

  assert.equal(technotreon.SOURCE, 'technotreon')
  assert.equal(technotreon.COMPANY, 'Technotreon')
  assert.equal(technotreon.HOMEPAGE_URL, 'https://technotreon.in/')
  assert.equal(technotreon.CAREERS_URL, 'https://technotreon.in/careers')
  assert.equal(technotreon.COMPANY_DOMAIN, 'technotreon.in')
  assert.equal(technotreon.ATS_PLATFORM, 'official-company-careers')
  assert.equal(technotreon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(technotreon.hasOfficialCareersSignal(careersHtml), true)
})

test('extractListings preserves public assessment descriptions without country or vacancy inference', async () => {
  const technotreon = await loadTechnotreonModule()

  assert.deepEqual(technotreon.extractListings(careersHtml), [
    {
      title: 'Business and Marketing Standardised Aptitude Test',
      applyUrl: 'https://forms.gle/business-role',
      department: 'Business and Marketing',
      description:
        'Join our dynamic team as a Business Rockstar! Drive brand awareness, execute innovative campaigns, analyze market trends, and unleash your creativity to captivate audiences. Collaborate with cross-functional teams to drive transformative ideas and shape our future. #BrandInnovator',
      location: null,
    },
    {
      title: 'Intellectual Property (Legal) STANDARDISED Aptitude Test',
      applyUrl: 'https://forms.gle/legal-role',
      department: 'Intellectual Property (Legal)',
      description:
        'Step into the world of intellectual property and legal innovation. You will work on patents, legal research, and IP strategy to protect and strengthen cutting-edge ideas. Gain hands-on experience in real-world legal challenges, contributing to innovation, compliance, and strategic decision-making.',
      location: null,
    },
    {
      title: 'Engineering STANDARDISED Aptitude Test',
      applyUrl: 'https://forms.gle/engineering-role',
      department: 'Engineering',
      description:
        "Immerse yourself in cutting-edge innovation research and discover new horizons. We're seeking passionate individuals to pioneer electronic design innovation. Work alongside diverse teams to catalyze groundbreaking ideas and mould our future. Be part of the driving force behind the next major breakthrough!",
      location: null,
    },
    {
      title: 'HR Assistant STANDARDISED Aptitude Test',
      applyUrl: 'https://forms.gle/hr-role',
      department: 'HR Assistant',
      description:
        'Step into people management and organizational growth. As an HR Assistant, you will support recruitment, employee engagement, and HR operations while contributing to a positive workplace culture. Work with dynamic teams and gain hands-on experience in HR processes, helping drive organizational success.',
      location: null,
    },
  ])
})

test('run rejects body-only page text instead of persisting assessment cards as vacancies', async () => {
  const technotreon = await loadTechnotreonModule()
  const requestedUrls = []
  await assert.rejects(technotreon.createTechnotreonScraper().run({ fetchText: async url => {
    requestedUrls.push(url)
    return url === technotreon.HOMEPAGE_URL ? homepageHtml : careersHtml
  } }), /native HTTP response metadata required/)
  assert.deepEqual(requestedUrls, [])
})

test('run preserves employer identity guards and rejects unverifiable body-only page changes', async () => {
  const technotreon = await loadTechnotreonModule()
  assert.equal(technotreon.hasOfficialHomepageSignal('<html><title>Unexpected</title></html>'), false)
  assert.equal(technotreon.hasOfficialCareersSignal(careersHtml.replace('DEPARTMENTS AT TECHNOTREON', 'JOIN US')), false)
  assert.equal(technotreon.hasOfficialCareersSignal(careersHtml.replaceAll('https://forms.gle/', 'https://untrusted.example/')), false)
  await assert.rejects(technotreon.createTechnotreonScraper().run({ fetchText: async () => '<title>Unexpected</title>' }), /native HTTP response metadata required/)
})

test('homepage transport exceptions from body-only fixtures cannot prove vacancy identity or country', async () => {
  const technotreon = await loadTechnotreonModule()
  let attempts = 0
  await assert.rejects(technotreon.createTechnotreonScraper().run({ fetchText: async () => {
    attempts++
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } })
  } }), /native HTTP response metadata required/)
  assert.equal(attempts, 0)
})

test('body-only timeout fixtures cannot be converted into company empty-inventory evidence', async () => {
  const technotreon = await loadTechnotreonModule()
  await assert.rejects(technotreon.createTechnotreonScraper().run({ fetchText: async () => {
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } })
  } }), /native HTTP response metadata required/)
})
