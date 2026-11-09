import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const loadPletraModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Pletra scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Certified Salesforce Implementation Partner | Pletratech</title>
  </head>
  <body>
    <nav>
      <a href="https://pletratech.com/">Home</a>
      <a href="https://pletratech.com/about-us/">About Us</a>
      <a href="https://pletratech.com/careers-pletra-technologies/">Careers</a>
      <a href="https://pletratech.com/careers-page/">Career</a>
      <a href="https://pletratech.com/contact-us/">Contact Us</a>
    </nav>
    <main>
      <section>
        <h1>Trusted Salesforce Implementation Partner</h1>
        <p>Pletratech helps organizations across India and beyond.</p>
      </section>
    </main>
    <footer>
      <a href="mailto:info@pletratech.com">info@pletratech.com</a>
    </footer>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us - Salesforce Implementation, Consulting &amp; Software Solutions</title>
  </head>
  <body>
    <main>
      <h1>Pletra Technologies India Offices</h1>
      <p>Pune Address - Office # 102, Pentagon 1, Magarpatta City, Hadapsar, Pune-411013</p>
      <p><a href="mailto:info@pletratech.com">info@pletratech.com</a></p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Salesforce Implementation, Consulting &amp; Software Solutions</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <div class="elementor-accordion">
        <div class="elementor-accordion-item">
          <div class="elementor-tab-title">
            <a class="elementor-accordion-title" tabindex="0">Business Development Manger</a>
          </div>
          <div class="elementor-tab-content">
            <ul>
              <li>Should have 5 to 8 years experience.</li>
              <li>At least 3+ Years of experience in staff augmentation and Project management</li>
              <li>Hands on experience in IT Staffing Sales, Business Development, IT Talent Deployment, Contract Staffing, Staffing Sales, Client Acquisition, Hands-on Customer Relationship Management</li>
              <li>Need to handle and connect with C- level decision makers, handling domestic and International Clients.</li>
              <li>Must have experience in Salesforce staff augmentation and project implementation.</li>
            </ul>
          </div>
        </div>

        <div class="elementor-accordion-item">
          <div class="elementor-tab-title">
            <a class="elementor-accordion-title" tabindex="0">Salesforce Trainer- Location- Pune</a>
          </div>
          <div class="elementor-tab-content">
            <ul>
              <li>3+ years of experience as a Salesforce trainer</li>
              <li>Expertise in Admin, Development, LWC, Apex, and Trigger</li>
              <li>Excellent communication skills (verbal and written)</li>
              <li>Ability to present complex information clearly</li>
            </ul>
          </div>
        </div>

        <div class="elementor-accordion-item">
          <div class="elementor-tab-title">
            <a class="elementor-accordion-title" tabindex="0">Business Developement Intern- Belgium</a>
          </div>
          <div class="elementor-tab-content">
            <ul>
              <li>Must have fluency in Dutch, French, and English</li>
              <li>Strong interpersonal skills</li>
              <li>Proficiency in MS Office Suite and translation tools</li>
              <li>DIgital markting skills nice to have</li>
              <li>Ability to conduct surveys and collect data</li>
              <li>Any bachelor's degree in Business or related field (final-year students welcome)</li>
              <li>Stipend- 500 EURO+ Benefits</li>
            </ul>
          </div>
        </div>
      </div>
      <footer>
        <a href="mailto:info@pletratech.com">info@pletratech.com</a>
      </footer>
    </main>
  </body>
</html>
`

test('Pletra scraper recognizes the verified homepage, contact page, careers page, and inline public openings', async () => {
  const pletra = await loadPletraModule()

  assert.equal(pletra.SOURCE, 'pletratechnologiesindiapvtltd')
  assert.equal(pletra.COMPANY, 'Pletra Technologies India Pvt. Ltd.')
  assert.equal(pletra.HOMEPAGE_URL, 'https://pletratech.com/')
  assert.equal(pletra.CONTACT_URL, 'https://pletratech.com/contact-us/')
  assert.equal(pletra.CAREERS_URL, 'https://pletratech.com/careers-pletra-technologies/')
  assert.deepEqual(pletra.CAREERS_ALIAS_URLS, ['https://pletratech.com/careers-page/'])
  assert.equal(pletra.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(pletra.hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(pletra.hasOfficialContactSignal(contactHtml), true)
  assert.equal(pletra.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    pletra.isVerifiedCareersAlias({
      status: 200,
      url: pletra.CAREERS_URL,
      html: careersHtml,
    }),
    true,
  )

  assert.deepEqual(pletra.extractPublicJobs(careersHtml), [
    {
      title: 'Business Development Manger',
      company: 'Pletra Technologies India Pvt. Ltd.',
      location: null,
      city: null,
      country: null,
      jobId: 'pletratechnologiesindiapvtltd-business-development-manger-unresolved',
      requisitionId: 'pletratechnologiesindiapvtltd-business-development-manger-unresolved',
      sourceUrl: 'https://pletratech.com/careers-pletra-technologies/',
      applyUrl: 'https://pletratech.com/careers-pletra-technologies/',
      employmentType: null,
      experienceRequired: '5 to 8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Should have 5 to 8 years experience.',
        'At least 3+ Years of experience in staff augmentation and Project management',
        'Hands on experience in IT Staffing Sales, Business Development, IT Talent Deployment, Contract Staffing, Staffing Sales, Client Acquisition, Hands-on Customer Relationship Management',
        'Need to handle and connect with C- level decision makers, handling domestic and International Clients.',
        'Must have experience in Salesforce staff augmentation and project implementation.',
      ].join('\n'),
      remoteStatus: null,
    },
    {
      title: 'Salesforce Trainer',
      company: 'Pletra Technologies India Pvt. Ltd.',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'pletratechnologiesindiapvtltd-salesforce-trainer-pune-india',
      requisitionId: 'pletratechnologiesindiapvtltd-salesforce-trainer-pune-india',
      sourceUrl: 'https://pletratech.com/careers-pletra-technologies/',
      applyUrl: 'https://pletratech.com/careers-pletra-technologies/',
      employmentType: null,
      experienceRequired: '3+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        '3+ years of experience as a Salesforce trainer',
        'Expertise in Admin, Development, LWC, Apex, and Trigger',
        'Excellent communication skills (verbal and written)',
        'Ability to present complex information clearly',
      ].join('\n'),
      remoteStatus: null,
    },
    {
      title: 'Business Developement Intern',
      company: 'Pletra Technologies India Pvt. Ltd.',
      location: 'Belgium',
      city: null,
      country: 'Belgium',
      jobId: 'pletratechnologiesindiapvtltd-business-developement-intern-belgium',
      requisitionId: 'pletratechnologiesindiapvtltd-business-developement-intern-belgium',
      sourceUrl: 'https://pletratech.com/careers-pletra-technologies/',
      applyUrl: 'https://pletratech.com/careers-pletra-technologies/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Must have fluency in Dutch, French, and English',
        'Strong interpersonal skills',
        'Proficiency in MS Office Suite and translation tools',
        'DIgital markting skills nice to have',
        'Ability to conduct surveys and collect data',
        "Any bachelor's degree in Business or related field (final-year students welcome)",
        'Stipend- 500 EURO+ Benefits',
      ].join('\n'),
      remoteStatus: null,
    },
  ])
})

test('Pletra scraper runs end to end, validates the careers alias, and returns India-scoped jobs', async () => {
  const pletra = await loadPletraModule()
  const requestedUrls = []

  const jobs = await pletra.createPletraTechnologiesIndiaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === pletra.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === pletra.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (url === pletra.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (pletra.CAREERS_ALIAS_URLS.includes(url)) {
        return { status: 200, url: pletra.CAREERS_URL, html: careersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    pletra.HOMEPAGE_URL,
    pletra.CONTACT_URL,
    pletra.CAREERS_URL,
    ...pletra.CAREERS_ALIAS_URLS,
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.country]),
    [
      ['Salesforce Trainer', 'Pune, India', 'India'],
    ],
  )
  assert.equal(jobs[0].source, pletra.SOURCE)
  assert.equal(jobs[0].company, pletra.COMPANY)
  assert.equal(jobs[0].link, pletra.CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].companyCareerPage, pletra.CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'pletratech.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].sourceListingComplete, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 3)
  assert.equal(evidence.indiaFacetCount, null)
})

test('Pletra scraper fails closed when the verified public surface drifts', async () => {
  const pletra = await loadPletraModule()

  await assert.rejects(
    pletra.createPletraTechnologiesIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === pletra.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    pletra.createPletraTechnologiesIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === pletra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === pletra.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === pletra.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><main>No jobs here</main></body></html>' }
        }

        if (pletra.CAREERS_ALIAS_URLS.includes(url)) {
          return { status: 200, url: pletra.CAREERS_URL, html: careersHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers surface|public openings/i,
  )

  await assert.rejects(
    pletra.createPletraTechnologiesIndiaScraper().run({
      fetchPage: async (url) => {
        if (url === pletra.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === pletra.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === pletra.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (pletra.CAREERS_ALIAS_URLS.includes(url)) {
          return { status: 200, url, html: careersHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers alias/i,
  )
})
