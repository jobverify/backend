import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FabHotels: India's Best Budget Hotels | Online Hotel Booking</title>
  </head>
  <body>
    <main>
      <p>Book top-rated budget hotels in India.</p>
      <p>FabHotels across</p>
      <p>Trusted by 500,000+ verified guests</p>
      <footer>
        <p>© 2026 Travelstack Tech Limited (formerly known as Travelstack Tech Private Limited and Casa2 Stays Pvt Ltd). All rights reserved.</p>
      </footer>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers @ FabHotels - FabHotels.com</title>
  </head>
  <body>
    <main>
      <ul class="departments">
        <li>All</li>
        <li>Technology</li>
        <li>Sales</li>
        <li>Revenue And Pricing</li>
        <li>Design</li>
      </ul>
      <div class="career-listing">
        <a href="/careers/FS-TECH-P1">Backend/ Full Stack Developer Technology Gurgaon 2-4 Years</a>
        <a href="/careers/CS-B2B-P1">Agent/Sr. Executive/AM- Corporate Sales Sales Multiple 1-5 Years</a>
        <a href="/careers/BA-RP-P1">Business Analyst - Growth Revenue and Pricing Gurgaon 1-4 Years</a>
        <a href="/careers/TT-TA-P4">Manager- Travel Trade Sales Chennai 6-9 Years</a>
        <a href="/careers/UX-DD-P1">UX Designer Design Gurgaon 2-5 Years</a>
        <a href="/careers/TA-SA-P1">Executive/Senior Executive – Travel Agent Sales Sales Multiple 1-6 Years</a>
      </div>
    </main>
  </body>
</html>
`

const backendDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Details @ FabHotels.com - FabHotels.com</title>
  </head>
  <body>
    <main>
      <a href="/careers/">Go back to Careers</a>
      <p>Apply to this Job</p>
      <h3>Backend/ Full Stack Developer</h3>
      <p>Department: Technology</p>
      <p>Location: Gurgaon</p>
      <p>Relevant Experience: 2-4 Years</p>
      <h3>Job Role:</h3>
      <ul>
        <li>Design APIs, DB, Queues, monitoring for micro services.</li>
        <li>Writing, deploying and managing micro services.</li>
      </ul>
      <h4>Experience:</h4>
      <ul>
        <li>B.E./B.Tech (CS)/ MTECH from tier-I engineering institutes or universities with 2-4 years of work experience.</li>
        <li>Must have experience in Java+ Angular/React</li>
      </ul>
      <p>If you have similar experience then please share your updated CV at jobs@fabhotels.com</p>
    </main>
  </body>
</html>
`

const corporateSalesDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Details @ FabHotels.com - FabHotels.com</title>
  </head>
  <body>
    <main>
      <a href="/careers/">Go back to Careers</a>
      <p>Apply to this Job</p>
      <h3>Agent/Sr. Executive/AM- Corporate Sales</h3>
      <p>Department: Sales</p>
      <p>Location: Bangalore, Chennai, Mumbai</p>
      <p>Relevant Experience: 1-5 Years</p>
      <h3>Job Role:</h3>
      <ul>
        <li>Identifying market movers of B2B sales and setting up meetings with Corporate Client</li>
        <li>Building a network of Corporate Client</li>
      </ul>
      <p>If you have similar experience then please share your updated CV at jobs@fabhotels.com</p>
    </main>
  </body>
</html>
`

const businessAnalystDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Details @ FabHotels.com - FabHotels.com</title>
  </head>
  <body>
    <main>
      <a href="/careers/">Go back to Careers</a>
      <p>Apply to this Job</p>
      <h3>Business Analyst - Growth</h3>
      <p>Department: Revenue and Pricing</p>
      <p>Location: Gurgaon</p>
      <p>Relevant Experience: 1-4 Years</p>
      <h3>Job Role:</h3>
      <ul>
        <li>Experience on Excel and SQL</li>
        <li>Good to have experience on BI tools like Tableau</li>
      </ul>
      <p>If you have similar experience then please share your updated CV at jobs@fabhotels.com</p>
    </main>
  </body>
</html>
`

const uxDesignerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Details @ FabHotels.com - FabHotels.com</title>
  </head>
  <body>
    <main>
      <a href="/careers/">Go back to Careers</a>
      <p>Apply to this Job</p>
      <h3>UX Designer</h3>
      <p>Department: Design</p>
      <p>Location: Gurgaon</p>
      <p>Relevant Experience: 2-5 Years</p>
      <h3>Job Role:</h3>
      <ul>
        <li>You will be responsible for guest experience on our web site, mobile web and Android/ iOS app</li>
        <li>Suggest, define and create wireframing/ mocks of improvements to our sites and apps experiences</li>
      </ul>
      <h4>Experience &amp; Educational Qualifications:</h4>
      <ul>
        <li>2-5 years of experience in UI/ UX implementation for consumer products</li>
        <li>The portfolio must exhibit an understanding of user experience design principles</li>
      </ul>
      <p>If you have similar experience then please share your updated CV at jobs@fabhotels.com</p>
    </main>
  </body>
</html>
`

const travelAgentSalesDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Details @ FabHotels.com - FabHotels.com</title>
  </head>
  <body>
    <main>
      <a href="/careers/">Go back to Careers</a>
      <p>Apply to this Job</p>
      <h3>Executive/Senior Executive – Travel Agent Sales</h3>
      <p>Department: Sales</p>
      <p>Location: Kolkata, Delhi/NCR, Mumbai, Pune, Chennai, Ahmadabad, Patna, Bangalore, Hyderabad, Kerala, Chandigarh</p>
      <p>Relevant Experience: 1-6 Years</p>
      <h3>Job Role:</h3>
      <ul>
        <li>Identifying market movers of TA industry and setting up meetings with them</li>
        <li>Building a network of travel agents</li>
      </ul>
      <p>If you have similar experience then please share your updated CV at jobs@fabhotels.com</p>
    </main>
  </body>
</html>
`

const invalidCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers @ FabHotels - FabHotels.com</title>
  </head>
  <body>
    <main>
      <p>Roles coming soon.</p>
    </main>
  </body>
</html>
`

const invalidDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Details @ FabHotels.com - FabHotels.com</title>
  </head>
  <body>
    <main>
      <h3>Backend/ Full Stack Developer</h3>
      <p>Department: Technology</p>
    </main>
  </body>
</html>
`

const loadFabHotelsModule = async () => {
  try {
    return await import('../../scraper/fabhotels/script.js')
  } catch {
    assert.fail('Expected FabHotels scraper module at ../../scraper/fabhotels/script.js')
  }
}

test('FabHotels retains its historical July 15 presentation parser contract', async () => {
  const fabHotels = await loadFabHotelsModule()

  assert.equal(fabHotels.SOURCE, 'fabhotels')
  assert.equal(fabHotels.COMPANY_NAME, 'FabHotels')
  assert.equal(fabHotels.OFFICIAL_BRAND_NAME, 'FabHotels')
  assert.equal(fabHotels.VERIFIED_AT, '2026-07-15')
  assert.equal(fabHotels.HOMEPAGE_URL, 'https://www.fabhotels.com/')
  assert.equal(fabHotels.CAREERS_URL, 'https://www.fabhotels.com/careers/')
  assert.equal(fabHotels.APPLICATION_EMAIL, 'jobs@fabhotels.com')
  assert.equal(fabHotels.APPLICATION_URL, 'mailto:jobs@fabhotels.com')
  assert.deepEqual(fabHotels.VERIFIED_ROLE_URLS, [
    'https://www.fabhotels.com/careers/FS-TECH-P1',
    'https://www.fabhotels.com/careers/CS-B2B-P1',
    'https://www.fabhotels.com/careers/BA-RP-P1',
    'https://www.fabhotels.com/careers/TT-TA-P4',
    'https://www.fabhotels.com/careers/UX-DD-P1',
    'https://www.fabhotels.com/careers/TA-SA-P1',
  ])
  assert.equal(fabHotels.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(fabHotels.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(fabHotels.extractRoleUrls(careersHtml), fabHotels.VERIFIED_ROLE_URLS)
  assert.equal(fabHotels.hasOfficialRoleDetailSignal(backendDetailHtml), true)
  assert.deepEqual(
    fabHotels.extractJobDetail(
      backendDetailHtml,
      'https://www.fabhotels.com/careers/FS-TECH-P1',
    ),
    {
      title: 'Backend/ Full Stack Developer',
      company: 'FabHotels',
      department: 'Technology',
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      state: 'Haryana',
      country: 'India',
      jobId: 'FS-TECH-P1',
      requisitionId: 'FS-TECH-P1',
      sourceUrl: 'https://www.fabhotels.com/careers/FS-TECH-P1',
      applyUrl: 'mailto:jobs@fabhotels.com',
      employmentType: null,
      experienceRequired: '2-4 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Design APIs, DB, Queues, monitoring for micro services.',
        'Writing, deploying and managing micro services.',
        'B.E./B.Tech (CS)/ MTECH from tier-I engineering institutes or universities with 2-4 years of work experience.',
        'Must have experience in Java+ Angular/React',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Job Role: Design APIs, DB, Queues, monitoring for micro services. Writing, deploying and managing micro services. Experience: B.E./B.Tech (CS)/ MTECH from tier-I engineering institutes or universities with 2-4 years of work experience. Must have experience in Java+ Angular/React If you have similar experience then please share your updated CV at jobs@fabhotels.com',
    },
  )
})

// Historical parser helpers remain below their original verification date.
// Current source-directory tests replay complete original native HTTP inputs.
test('FabHotels current acquisition rejects body-only historical role lists and city-inferred eligibility', async () => {
  const fabHotels = await loadFabHotelsModule()
  await assert.rejects(fabHotels.createFabHotelsScraper().run({ fetchText: async () => careersHtml }), /original HTTP metadata|body-only/i)
})

test('FabHotels historical detail parser still rejects changed application copy', async () => {
  const fabHotels = await loadFabHotelsModule()
  assert.throws(() => fabHotels.extractJobDetail(invalidDetailHtml, 'https://www.fabhotels.com/careers/FS-TECH-P1'), /verified role detail surface/i)
})
