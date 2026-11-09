import assert from 'node:assert/strict'
import test from 'node:test'

const loadNashTechLabsModule = async () => {
  try {
    return await import('../../scraper/nashtechlabs/script.js')
  } catch {
    assert.fail('Expected Nash Tech Labs scraper module at ../../scraper/nashtechlabs/script.js')
  }
}

const verifiedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>India's Leading OEM &amp; ODM Electronics Manufacturer | NTL</title>
    <meta
      name="description"
      content="India's leading OEM/ODM partner, Nash Tech Labs delivers end-to-end electronics solutions."
    />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/about-us">About Us</a>
      <a href="/contact-us">Contact Us</a>
    </nav>
    <main>
      <h1>Concept to Creation: Partnering for Global Success</h1>
      <h2>Fastest Growing Innovation Center</h2>
      <p>
        At Nash Tech Labs (NTL), we draw expertise from five decades of manufacturing excellence of Nash Industries.
      </p>
      <p>
        Serving several Fortune 500 companies and exporting to over 15 countries, NTL has forged strategic alliances
        with the global technology leaders such as Intel, Hitachi.
      </p>
      <p>Address Head Quarters:</p>
      <p>115, 3, 6th Main Rd, Yeshwanthpur Suburb II Stage, Bengaluru, Karnataka 560022</p>
      <p>&copy; 2025 Nash Tech Labs | All rights reserved.</p>
    </main>
  </body>
</html>
`

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>careers</title>
  </head>
  <body>
    <main>
      <section class="uui-section_career07">
        <div class="uui-career07_content">
          <div class="uui-heading-subheading-8">We're hiring!</div>
          <h2 class="uui-heading-medium-8">We're looking for talented people</h2>
          <div class="uui-text-size-large-11">
            Our philosophy is simple - hire a team of diverse, passionate people and foster a culture that empowers
            you to do your best work.
          </div>
        </div>
        <div class="uui-career07_list">
          <div class="uui-career07_item">
            <div class="uui-career07_title-wrapper">
              <div class="uui-career07_heading">Senior/Lead Engineer</div>
              <div class="uui-career07_label-wrapper">
                <div class="uui-badge-3 is-blue"><div>Power Electronics</div></div>
              </div>
            </div>
            <div class="uui-text-size-medium-12">We're looking for someone motivated and experienced to join our team.</div>
            <div class="uui-career07_job-details-wrapper">
              <div class="uui-career07_detail-wrapper"><div>Peenya, Bengaluru</div></div>
              <div class="uui-career07_detail-wrapper"><div>4-5 years</div></div>
            </div>
            <div class="uui-button-row-8">
              <div class="uui-button-wrapper-6"><a href="#" class="uui-button-secondary-gray-7">Apply now</a></div>
              <div class="uui-button-wrapper-6">
                <a
                  href="https://cdn.prod.website-files.com/66a9e20e39727c40cabc8902/685916666e9aa8c1a254216c_Power%20Electronics.pdf"
                  class="uui-button-9"
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
          <div class="uui-career07_item">
            <div class="uui-career07_title-wrapper">
              <div class="uui-career07_heading">Senior sales</div>
              <div class="uui-career07_label-wrapper">
                <div class="uui-badge-3 is-pink"><div>Sales &amp; Marketing</div></div>
              </div>
            </div>
            <div class="uui-text-size-medium-12">We're looking for someone motivated and experienced to join our team.</div>
            <div class="uui-career07_job-details-wrapper">
              <div class="uui-career07_detail-wrapper"><div>Peenya, Bengaluru</div></div>
              <div class="uui-career07_detail-wrapper"><div>10+ years</div></div>
            </div>
            <div class="uui-button-row-8">
              <div class="uui-button-wrapper-6"><a href="#" class="uui-button-secondary-gray-7">Apply now</a></div>
              <div class="uui-button-wrapper-6">
                <a
                  href="https://cdn.prod.website-files.com/66a9e20e39727c40cabc8902/68591666d7d8aa183fef65de_Sales-%20Manager.pdf"
                  class="uui-button-9"
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
          <div class="uui-career07_item">
            <div class="uui-career07_title-wrapper">
              <div class="uui-career07_heading">Project manager</div>
              <div class="uui-career07_label-wrapper">
                <div class="uui-badge-3 is-success"><div>Projects</div></div>
              </div>
            </div>
            <div class="uui-text-size-medium-12">We're looking for someone motivated and experienced to join our team.</div>
            <div class="uui-career07_job-details-wrapper">
              <div class="uui-career07_detail-wrapper"><div>Peenya, Bengaluru</div></div>
              <div class="uui-career07_detail-wrapper"><div>10-15 years</div></div>
            </div>
            <div class="uui-button-row-8">
              <div class="uui-button-wrapper-6"><a href="#" class="uui-button-secondary-gray-7">Apply now</a></div>
              <div class="uui-button-wrapper-6">
                <a
                  href="https://cdn.prod.website-files.com/66a9e20e39727c40cabc8902/6859164db8ad3fbf526e2398_Project%20Manager-JD.pdf"
                  class="uui-button-9"
                >
                  Learn more
                </a>
              </div>
            </div>
          </div>
          <div class="uui-career07_item">
            <div class="uui-career07_title-wrapper">
              <div class="uui-career07_heading">Account Executive</div>
              <div class="uui-career07_label-wrapper">
                <div class="uui-badge-3 is-indigo"><div>Sales</div></div>
              </div>
            </div>
            <div class="uui-text-size-medium-12">We're looking for someone motivated and experienced to join our team.</div>
            <div class="uui-career07_job-details-wrapper">
              <div class="uui-career07_detail-wrapper"><div>Remote</div></div>
              <div class="uui-career07_detail-wrapper"><div>Full-time</div></div>
            </div>
            <div class="uui-button-row-8">
              <div class="uui-button-wrapper-6"><a href="#" class="uui-button-secondary-gray-7">Apply now</a></div>
              <div class="uui-button-wrapper-6"><a href="#" class="uui-button-9">Learn more</a></div>
            </div>
          </div>
          <div class="uui-career07_item">
            <div class="uui-career07_title-wrapper">
              <div class="uui-career07_heading">SEO Marketing Manager</div>
              <div class="uui-career07_label-wrapper">
                <div class="uui-badge-3 is-orange"><div>Marketing</div></div>
              </div>
            </div>
            <div class="uui-text-size-medium-12">We're looking for someone motivated and experienced to join our team.</div>
            <div class="uui-career07_job-details-wrapper">
              <div class="uui-career07_detail-wrapper"><div>Remote</div></div>
              <div class="uui-career07_detail-wrapper"><div>Full-time</div></div>
            </div>
            <div class="uui-button-row-8">
              <div class="uui-button-wrapper-6"><a href="#" class="uui-button-secondary-gray-7">Apply now</a></div>
              <div class="uui-button-wrapper-6"><a href="#" class="uui-button-9">Learn more</a></div>
            </div>
          </div>
        </div>
      </section>
      <section class="uui-section_contact03-2">
        <h2>Apply with us</h2>
      </section>
    </main>
  </body>
</html>
`

test('Nash Tech Labs validates the verified official homepage and first-party careers shell', async () => {
  const nash = await loadNashTechLabsModule()

  assert.equal(nash.SOURCE, 'nashtechlabs')
  assert.equal(nash.COMPANY, 'Nash Tech Labs')
  assert.equal(nash.HOMEPAGE_URL, 'https://www.nashtechlabs.com/')
  assert.equal(nash.CAREERS_URL, 'https://www.nashtechlabs.com/careers')
  assert.equal(nash.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(nash.hasOfficialCareersSignal(verifiedCareersHtml), true)

  assert.deepEqual(nash.extractPublicJobs(verifiedCareersHtml), [
    {
      title: 'Senior/Lead Engineer',
      company: 'Nash Tech Labs',
      department: 'Power Electronics',
      location: 'Peenya, Bengaluru',
      city: 'Peenya',
      country: 'India',
      jobId: 'nashtechlabs-senior-lead-engineer-power-electronics-peenya-bengaluru',
      requisitionId: 'nashtechlabs-senior-lead-engineer-power-electronics-peenya-bengaluru',
      sourceUrl: 'https://cdn.prod.website-files.com/66a9e20e39727c40cabc8902/685916666e9aa8c1a254216c_Power%20Electronics.pdf',
      applyUrl: null,
      employmentType: null,
      experienceRequired: '4-5 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Senior sales',
      company: 'Nash Tech Labs',
      department: 'Sales & Marketing',
      location: 'Peenya, Bengaluru',
      city: 'Peenya',
      country: 'India',
      jobId: 'nashtechlabs-senior-sales-sales-marketing-peenya-bengaluru',
      requisitionId: 'nashtechlabs-senior-sales-sales-marketing-peenya-bengaluru',
      sourceUrl: 'https://cdn.prod.website-files.com/66a9e20e39727c40cabc8902/68591666d7d8aa183fef65de_Sales-%20Manager.pdf',
      applyUrl: null,
      employmentType: null,
      experienceRequired: '10+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Project manager',
      company: 'Nash Tech Labs',
      department: 'Projects',
      location: 'Peenya, Bengaluru',
      city: 'Peenya',
      country: 'India',
      jobId: 'nashtechlabs-project-manager-projects-peenya-bengaluru',
      requisitionId: 'nashtechlabs-project-manager-projects-peenya-bengaluru',
      sourceUrl: 'https://cdn.prod.website-files.com/66a9e20e39727c40cabc8902/6859164db8ad3fbf526e2398_Project%20Manager-JD.pdf',
      applyUrl: null,
      employmentType: null,
      experienceRequired: '10-15 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'Account Executive',
      company: 'Nash Tech Labs',
      department: 'Sales',
      location: 'Remote',
      city: 'Remote',
      country: 'India',
      jobId: 'nashtechlabs-account-executive-sales-remote',
      requisitionId: 'nashtechlabs-account-executive-sales-remote',
      sourceUrl: 'https://www.nashtechlabs.com/careers',
      applyUrl: null,
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'SEO Marketing Manager',
      company: 'Nash Tech Labs',
      department: 'Marketing',
      location: 'Remote',
      city: 'Remote',
      country: 'India',
      jobId: 'nashtechlabs-seo-marketing-manager-marketing-remote',
      requisitionId: 'nashtechlabs-seo-marketing-manager-marketing-remote',
      sourceUrl: 'https://www.nashtechlabs.com/careers',
      applyUrl: null,
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])
})

test('Nash Tech Labs run fetches the verified public homepage and careers page and normalizes jobs', async () => {
  const nash = await loadNashTechLabsModule()
  const requestedUrls = []

  const jobs = await nash.createNashTechLabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === nash.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === nash.CAREERS_URL) return verifiedCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [nash.HOMEPAGE_URL, nash.CAREERS_URL])
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].source, 'nashtechlabs')
  assert.equal(jobs[0].company, 'Nash Tech Labs')
  assert.equal(jobs[0].companyCareerPage, 'https://www.nashtechlabs.com/careers')
  assert.equal(jobs[0].companyDomain, 'nashtechlabs.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].jobType, 'Full-time Experienced')
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].sourceUrl, 'https://cdn.prod.website-files.com/66a9e20e39727c40cabc8902/685916666e9aa8c1a254216c_Power%20Electronics.pdf')
  assert.equal(jobs[3].remoteStatus, 'Remote')
  assert.equal(jobs[3].employmentType, 'Full-time')
  assert.equal(jobs[3].sourceUrl, 'https://www.nashtechlabs.com/careers')
})

test('Nash Tech Labs fails closed when the verified homepage or careers surface drifts materially', async () => {
  const nash = await loadNashTechLabsModule()

  await assert.rejects(
    nash.createNashTechLabsScraper().run({
      fetchText: async (url) => {
        if (url === nash.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    nash.createNashTechLabsScraper().run({
      fetchText: async (url) => {
        if (url === nash.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace("We're hiring!", 'Join us')
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    nash.createNashTechLabsScraper().run({
      fetchText: async (url) => {
        if (url === nash.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(/uui-career07_item/g, 'career-card')
      },
    }),
    /verified first-party careers page/i,
  )
})

test('Nash PDF recovery requires the linked document, native employer, role and department', async () => {
  const nash = await loadNashTechLabsModule()
  const job = nash.extractPublicJobs(verifiedCareersHtml)[0]
  const text = 'Nash Tech Labs — Power Electronics — Senior/Lead Engineer. Design power converters, review circuits, and validate engineering designs.'
  const response = { status: 200, url: job.sourceUrl, text }
  assert.deepEqual(nash.recoverNashPdfDescription(job, response), { sourceDescription: text })
  for (const change of [
    { status: 403 }, { url: 'https://www.nashtechlabs.com/careers' },
    { text: text.replace('Nash Tech Labs', 'Another Employer') },
    { text: text.replace('Senior/Lead Engineer', 'Another Role') },
    { text: text.replace('Power Electronics', 'Other Department') },
  ]) assert.equal(nash.recoverNashPdfDescription(job, { ...response, ...change }), null)
  assert.equal(nash.recoverNashPdfDescription({ ...job, sourceUrl: 'https://unrelated.example/role.pdf' }, response), null)
})

test('Nash preserves verified PDF source content without claiming that a separate full inventory is complete', async () => {
  const nash = await loadNashTechLabsModule()
  const jobs = await nash.createNashTechLabsScraper().run({
    fetchText: async url => url === nash.HOMEPAGE_URL ? verifiedHomepageHtml : verifiedCareersHtml,
    fetchPdfText: async job => ({ status: 200, url: job.sourceUrl,
      text: `Nash Tech Labs ${job.department} ${job.title}. Design reliable products, review technical work and collaborate with the team.` }),
    now: () => '2026-10-29T14:00:00.000Z',
  })
  assert.ok(jobs.slice(0, 3).every(job => job.sourceDescription && job.sourceDescription.includes('Nash Tech Labs')))
  assert.ok(jobs.slice(0, 3).every(job => job.sourceDetailComplete === false))
  assert.ok(jobs.slice(3).every(job => !job.sourceDescription), 'Generic careers URLs are not per-role PDF proof')
})
