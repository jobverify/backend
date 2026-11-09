import assert from 'node:assert/strict'
import test from 'node:test'

const loadHarmonyModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <a href="https://harmonyenviro.in/who-we-are/">Who We Are</a>
        <a href="https://harmonyenviro.in/career/">Career</a>
        <a href="https://harmonyenviro.in/contact-us/">Contact Us</a>
        <h1>Innovative Solutions For A Sustainable Future</h1>
        <h2>Leading the way in Air Quality Systems</h2>
        <p>Welcome to Harmony Environmental Solutions.</p>
        <p>At Harmony, we offer integrated solutions including design and engineering services.</p>
      </main>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Who We Are</h1>
        <p>Harmony Environmental Systems Private Limited (HESPL) offers Air Quality Systems to Industries across the world.</p>
        <p>In December 2022, HESPL acquired the Indian based operations of Hamon Research Cottrell India Pvt. Ltd. (HRCIN).</p>
        <p>Headquartered in Chennai, India, HESPL aims to support sustainable growth and development of industry.</p>
      </main>
    </body>
  </html>
`

const contactHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Contact Us</h1>
        <p>Pacifica Tech Park, Block 1, 1st Floor, Core-2, Module No. 1G & 1H, Survey No.76, 23 Rajiv Gandhi Salai (OMR), Navalur, Chennai, Chengalpattu, Tamil Nadu - 600130, India.</p>
        <p>+91 (44) 4909 0500</p>
        <p>info@harmonyenviro.in</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Career</h1>
        <h3>Current Openings</h3>
        <p>Be a part of our mission to preserve the planet and create a sustainable future.</p>
        <div class="careersoutputs">
          <div class="fusion-text carerjobtb careers-post post-675">
            <h4>Manager - Projects</h4>
            <ul>
              <li class="licon"><strong>Location : </strong>Chennai</li>
              <li class="exicon"><strong>Experience : </strong>10-12 Years</li>
            </ul>
            <p class="Aplubtn"><a class="Carerpopup">Apply Now</a></p>
          </div>
          <div class="fusion-text carerjobtb careers-post post-683">
            <h4>Detailer</h4>
            <ul>
              <li class="licon"><strong>Location : </strong>Chennai</li>
              <li class="exicon"><strong>Experience : </strong>5-8 Years</li>
            </ul>
            <p class="Aplubtn"><a class="Carerpopup">Apply Now</a></p>
          </div>
          <div class="fusion-text carerjobtb careers-post post-1834">
            <h4>Manager - Sales</h4>
            <ul>
              <li class="licon"><strong>Location : </strong>Gujarat</li>
              <li class="exicon"><strong>Experience : </strong>10-15 Years</li>
            </ul>
            <p class="Aplubtn"><a class="Carerpopup">Apply Now</a></p>
          </div>
          <div class="fusion-text carerjobtb careers-post post-1836">
            <h4>Manager - Sales</h4>
            <ul>
              <li class="licon"><strong>Location : </strong>Chennai</li>
              <li class="exicon"><strong>Experience : </strong>10-15 Years</li>
            </ul>
            <p class="Aplubtn"><a class="Carerpopup">Apply Now</a></p>
          </div>
          <div class="fusion-text carerjobtb careers-post post-1835">
            <h4>Manager - Procurement</h4>
            <ul>
              <li class="licon"><strong>Location : </strong>Noida</li>
              <li class="exicon"><strong>Experience : </strong>7-10 Years</li>
            </ul>
            <p class="Aplubtn"><a class="Carerpopup">Apply Now</a></p>
          </div>
          <div class="fusion-text carerjobtb careers-post post-2394">
            <h4>E&amp;I Design Engineer</h4>
            <ul>
              <li class="licon"><strong>Location : </strong>Chennai</li>
              <li class="exicon"><strong>Experience : </strong>3-5 Years</li>
            </ul>
            <p class="Aplubtn"><a class="Carerpopup">Apply Now</a></p>
          </div>
          <div class="fusion-text carerjobtb careers-post post-2395">
            <h4>Mechanical Engineer</h4>
            <ul>
              <li class="licon"><strong>Location : </strong>Chennai</li>
              <li class="exicon"><strong>Experience : </strong>3 -7 Years</li>
            </ul>
            <p class="Aplubtn"><a class="Carerpopup">Apply Now</a></p>
          </div>
        </div>
        <h3>Work with Harmony</h3>
        <form action="/career/#wpcf7-f447-o3" method="post" class="wpcf7-form init" enctype="multipart/form-data">
          <input type="text" name="your-name" />
          <input type="email" name="your-email" />
          <input type="tel" name="Your-phone" />
          <input type="text" name="your-position" />
          <input type="file" name="your-resume" />
          <input type="submit" value="Submit" />
        </form>
      </main>
    </body>
  </html>
`

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://harmonyenviro.in/career/detailer/</loc></url>
  <url><loc>https://harmonyenviro.in/career/manager-projects/</loc></url>
  <url><loc>https://harmonyenviro.in/career/manager-sales/</loc></url>
  <url><loc>https://harmonyenviro.in/career/manager-sales-2/</loc></url>
  <url><loc>https://harmonyenviro.in/career/manager-procurement/</loc></url>
  <url><loc>https://harmonyenviro.in/career/ei-design-engineer/</loc></url>
  <url><loc>https://harmonyenviro.in/career/mechanical-engineer/</loc></url>
</urlset>
`

const createDetailHtml = ({
  title,
  canonicalUrl,
  qualification,
  location,
  experience,
  description,
  previousUrl = 'https://harmonyenviro.in/career/manager-procurement/',
  nextUrl = 'https://harmonyenviro.in/career/mechanical-engineer/',
}) => `
  <!doctype html>
  <html lang="en">
    <head>
      <title>${title} - Harmony</title>
      <meta
        name="description"
        content="${title}${qualification}
Location : ${location}
Experience : ${experience}
position : 1${description}"
      />
      <link rel="canonical" href="${canonicalUrl}" />
    </head>
    <body>
      <a href="${previousUrl}" rel="prev">Previous</a>
      <a href="${nextUrl}" rel="next">Next</a>
      <article class="careers type-careers">
        <h1 class="entry-title fusion-post-title">${title}</h1>
        <div class="post-content">
          <div class="Jobtitletb">
            <h3>${title}</h3>
            <ul>
              <li>${qualification}</li>
              <li><strong>Location </strong>: ${location}</li>
              <li><strong>Experience</strong> : ${experience}</li>
              <li><strong>position</strong> : 1</li>
            </ul>
            <p>${description}</p>
          </div>
        </div>
      </article>
      <h3>Work with Harmony</h3>
      <form action="${canonicalUrl}#wpcf7-f447-o3" method="post" class="wpcf7-form init" enctype="multipart/form-data">
        <input type="text" name="your-name" />
        <input type="email" name="your-email" />
        <input type="tel" name="Your-phone" />
        <input type="text" name="your-position" />
        <input type="file" name="your-resume" />
        <input type="submit" value="Submit" />
      </form>
    </body>
  </html>
`

const eiDetailHtml = createDetailHtml({
  title: 'E&amp;I Design Engineer',
  canonicalUrl: 'https://harmonyenviro.in/career/ei-design-engineer/',
  qualification: 'Gradute in Electrical &amp; Instrumentation Engineering',
  location: 'Chennai',
  experience: '3 &#8211; 5 yrs',
  description:
    'We are looking for an experienced Electrical &amp; Instrumentation Design Engineer with strong AutoCAD skills to join our engineering team.',
})

const mechanicalDetailHtml = createDetailHtml({
  title: 'Mechanical Engineer',
  canonicalUrl: 'https://harmonyenviro.in/career/mechanical-engineer/',
  qualification: 'Graduate engineer with a minimum of 70% marks average',
  location: 'Chennai',
  experience: '3 &#8211; 7 yrs',
  description:
    'The role requires strong experience in mechanical engineering, including handling various mechanical equipment and performing design tasks for EPC, refinery, thermal power, mining, and oil &amp; gas projects.',
  previousUrl: 'https://harmonyenviro.in/career/ei-design-engineer/',
  nextUrl: '',
})

const detailerDetailHtml = createDetailHtml({
  title: 'Detailer',
  canonicalUrl: 'https://harmonyenviro.in/career/detailer/',
  qualification: 'Diploma / engineering graduate with detailing experience',
  location: 'Chennai',
  experience: '5 &#8211; 8 yrs',
  description: 'Create detailed engineering drawings and support drafting workflows for air quality systems.',
  previousUrl: '',
  nextUrl: 'https://harmonyenviro.in/career/manager-projects/',
})

const detailerDetailHtmlWithoutBanner = detailerDetailHtml.replace(
  '<h3>Work with Harmony</h3>',
  '<h3>Apply for this role</h3>',
)

const managerProjectsDetailHtml = createDetailHtml({
  title: 'Manager &#8211; Projects',
  canonicalUrl: 'https://harmonyenviro.in/career/manager-projects/',
  qualification: 'Engineering graduate with strong project execution background',
  location: 'Chennai',
  experience: '10 &#8211; 12 yrs',
  description: 'Lead project execution, planning, and delivery across complex environmental engineering programs.',
  previousUrl: 'https://harmonyenviro.in/career/detailer/',
  nextUrl: 'https://harmonyenviro.in/career/manager-sales/',
})

const managerSalesGujaratDetailHtml = createDetailHtml({
  title: 'Manager &#8211; Sales',
  canonicalUrl: 'https://harmonyenviro.in/career/manager-sales/',
  qualification: 'Sales leader with industrial equipment experience',
  location: 'Gujarat',
  experience: '10 &#8211; 15 yrs',
  description: 'Drive sales growth and customer development for Harmony products across the Gujarat market.',
  previousUrl: 'https://harmonyenviro.in/career/manager-projects/',
  nextUrl: 'https://harmonyenviro.in/career/manager-sales-2/',
})

const managerSalesChennaiDetailHtml = createDetailHtml({
  title: 'Manager &#8211; Sales',
  canonicalUrl: 'https://harmonyenviro.in/career/manager-sales-2/',
  qualification: 'Sales leader with industrial equipment experience',
  location: 'Chennai',
  experience: '10 &#8211; 15 yrs',
  description: 'Own regional industrial sales strategy and customer engagement from the Chennai base.',
  previousUrl: 'https://harmonyenviro.in/career/manager-sales/',
  nextUrl: 'https://harmonyenviro.in/career/manager-procurement/',
})

const managerProcurementDetailHtml = createDetailHtml({
  title: 'Manager &#8211; Procurement',
  canonicalUrl: 'https://harmonyenviro.in/career/manager-procurement/',
  qualification: 'Procurement leader with EPC and industrial sourcing experience',
  location: 'Noida',
  experience: '7 &#8211; 10 yrs',
  description: 'Lead procurement, vendor coordination, and sourcing strategy for major projects.',
  previousUrl: 'https://harmonyenviro.in/career/manager-sales-2/',
  nextUrl: 'https://harmonyenviro.in/career/ei-design-engineer/',
})

test('Harmony Environmental Systems Private Limited scraper pins the verified first-party surfaces and sitemap contract', async () => {
  const harmony = await loadHarmonyModule()
  assert.ok(harmony, 'Harmony scraper module should load')

  assert.equal(harmony.SOURCE, 'harmonyenvironmentalsystemsprivatelimited')
  assert.equal(harmony.COMPANY, 'Harmony Environmental Systems Private Limited')
  assert.equal(harmony.HOMEPAGE_URL, 'https://harmonyenviro.in/')
  assert.equal(harmony.ABOUT_URL, 'https://harmonyenviro.in/who-we-are/')
  assert.equal(harmony.CONTACT_URL, 'https://harmonyenviro.in/contact-us/')
  assert.equal(harmony.CAREERS_URL, 'https://harmonyenviro.in/career/')
  assert.equal(harmony.CAREERS_SITEMAP_URL, 'https://harmonyenviro.in/careers-sitemap.xml')
  assert.equal(harmony.APPLY_URL, 'https://harmonyenviro.in/career/')
  assert.equal(harmony.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(harmony.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(harmony.hasOfficialContactSignal(contactHtml), true)
  assert.equal(harmony.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(harmony.extractDetailUrlsFromSitemap(sitemapXml), [
    'https://harmonyenviro.in/career/detailer/',
    'https://harmonyenviro.in/career/manager-projects/',
    'https://harmonyenviro.in/career/manager-sales/',
    'https://harmonyenviro.in/career/manager-sales-2/',
    'https://harmonyenviro.in/career/manager-procurement/',
    'https://harmonyenviro.in/career/ei-design-engineer/',
    'https://harmonyenviro.in/career/mechanical-engineer/',
  ])
})

test('Harmony careers page exposes the verified seven public openings plus the shared apply form', async () => {
  const harmony = await loadHarmonyModule()
  assert.ok(harmony, 'Harmony scraper module should load')

  const cards = harmony.extractCareerCards(careersHtml)
  assert.equal(cards.length, 7)
  assert.deepEqual(cards[0], {
    title: 'Manager - Projects',
    location: 'Chennai',
    experienceRequired: '10 - 12 Years',
    applyUrl: 'https://harmonyenviro.in/career/',
  })
  assert.deepEqual(cards.at(-1), {
    title: 'Mechanical Engineer',
    location: 'Chennai',
    experienceRequired: '3 - 7 Years',
    applyUrl: 'https://harmonyenviro.in/career/',
  })
})

test('Harmony detail parsing extracts normalized role metadata from the verified E&I and Mechanical detail pages', async () => {
  const harmony = await loadHarmonyModule()
  assert.ok(harmony, 'Harmony scraper module should load')

  assert.deepEqual(
    harmony.extractJobDetail(
      eiDetailHtml,
      'https://harmonyenviro.in/career/ei-design-engineer/',
    ),
    {
      title: 'E&I Design Engineer',
      company: 'Harmony Environmental Systems Private Limited',
      department: null,
      location: 'Chennai',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: 'ei-design-engineer',
      requisitionId: 'ei-design-engineer',
      sourceUrl: 'https://harmonyenviro.in/career/ei-design-engineer/',
      applyUrl: 'https://harmonyenviro.in/career/',
      employmentType: null,
      experienceRequired: '3 - 5 yrs',
      minimumQualification: 'Gradute in Electrical & Instrumentation Engineering',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'We are looking for an experienced Electrical & Instrumentation Design Engineer with strong AutoCAD skills to join our engineering team.',
      remoteStatus: 'On-site',
    },
  )

  const mechanicalJob = harmony.extractJobDetail(
    mechanicalDetailHtml,
    'https://harmonyenviro.in/career/mechanical-engineer/',
  )

  assert.equal(mechanicalJob.title, 'Mechanical Engineer')
  assert.equal(mechanicalJob.city, 'Chennai')
  assert.equal(mechanicalJob.state, 'Tamil Nadu')
  assert.equal(mechanicalJob.country, 'India')
  assert.equal(mechanicalJob.experienceRequired, '3 - 7 yrs')
  assert.equal(mechanicalJob.applyUrl, 'https://harmonyenviro.in/career/')
  assert.match(mechanicalJob.jobDescription, /strong experience in mechanical engineering/i)
})

test('Harmony detail pages still validate when the legacy Work with Harmony banner is absent', async () => {
  const harmony = await loadHarmonyModule()
  assert.ok(harmony, 'Harmony scraper module should load')

  assert.equal(harmony.hasOfficialDetailSignal(detailerDetailHtmlWithoutBanner), true)
})

test('Harmony run validates the verified surfaces, walks the career sitemap, and stamps the shared apply contract', async () => {
  const harmony = await loadHarmonyModule()
  assert.ok(harmony, 'Harmony scraper module should load')

  const detailFixtures = new Map([
    ['https://harmonyenviro.in/career/detailer/', detailerDetailHtml],
    ['https://harmonyenviro.in/career/manager-projects/', managerProjectsDetailHtml],
    ['https://harmonyenviro.in/career/manager-sales/', managerSalesGujaratDetailHtml],
    ['https://harmonyenviro.in/career/manager-sales-2/', managerSalesChennaiDetailHtml],
    ['https://harmonyenviro.in/career/manager-procurement/', managerProcurementDetailHtml],
    ['https://harmonyenviro.in/career/ei-design-engineer/', eiDetailHtml],
    ['https://harmonyenviro.in/career/mechanical-engineer/', mechanicalDetailHtml],
  ])
  const requestedUrls = []

  const jobs = await harmony.createHarmonyEnvironmentalSystemsPrivateLimitedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === harmony.HOMEPAGE_URL) return homepageHtml
      if (url === harmony.ABOUT_URL) return aboutHtml
      if (url === harmony.CONTACT_URL) return contactHtml
      if (url === harmony.CAREERS_URL) return careersHtml
      if (url === harmony.CAREERS_SITEMAP_URL) return sitemapXml
      if (detailFixtures.has(url)) return detailFixtures.get(url)
      throw new Error(`Unexpected Harmony fixture URL: ${url}`)
    },
    now: () => '2026-07-12T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    harmony.HOMEPAGE_URL,
    harmony.ABOUT_URL,
    harmony.CONTACT_URL,
    harmony.CAREERS_URL,
    harmony.CAREERS_SITEMAP_URL,
    'https://harmonyenviro.in/career/detailer/',
    'https://harmonyenviro.in/career/manager-projects/',
    'https://harmonyenviro.in/career/manager-sales/',
    'https://harmonyenviro.in/career/manager-sales-2/',
    'https://harmonyenviro.in/career/manager-procurement/',
    'https://harmonyenviro.in/career/ei-design-engineer/',
    'https://harmonyenviro.in/career/mechanical-engineer/',
  ])
  assert.equal(jobs.length, 7)
  assert.equal(jobs.every((job) => job.source === 'harmonyenvironmentalsystemsprivatelimited'), true)
  assert.equal(jobs.every((job) => job.applyUrl === 'https://harmonyenviro.in/career/'), true)
  assert.equal(jobs.every((job) => job.scrapedAt === '2026-07-12T00:00:00.000Z'), true)

  const eiJob = jobs.find((job) => job.title === 'E&I Design Engineer')
  assert.ok(eiJob)
  assert.equal(eiJob.link, 'https://harmonyenviro.in/career/ei-design-engineer/')

  const procurementJob = jobs.find((job) => job.title === 'Manager - Procurement')
  assert.ok(procurementJob)
  assert.equal(procurementJob.city, 'Noida')
  assert.equal(procurementJob.state, 'Uttar Pradesh')
})

test('Harmony fails closed when the verified public careers surface drifts materially', async () => {
  const harmony = await loadHarmonyModule()
  assert.ok(harmony, 'Harmony scraper module should load')

  await assert.rejects(
    harmony.createHarmonyEnvironmentalSystemsPrivateLimitedScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected homepage</h1></body></html>',
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    harmony.createHarmonyEnvironmentalSystemsPrivateLimitedScraper().run({
      fetchText: async (url) => {
        if (url === harmony.HOMEPAGE_URL) return homepageHtml
        if (url === harmony.ABOUT_URL) return aboutHtml
        if (url === harmony.CONTACT_URL) return contactHtml
        return careersHtml.replaceAll('Your-phone', 'Your-mobile')
      },
    }),
    /verified careers page/i,
  )
})
