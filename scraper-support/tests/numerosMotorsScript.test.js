import assert from 'node:assert/strict'
import test from 'node:test'

const loadNumerosMotorsModule = async () => {
  try {
    return await import('../../scraper/numerosmotors/script.js')
  } catch {
    assert.fail('Expected Numeros Motors scraper module at ../../scraper/numerosmotors/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Always Moving, Always Numeros: Cleaner, Smarter Electric | Numeros Motors</title>
    <link rel="canonical" href="https://numerosmotors.com/" />
    <meta property="og:site_name" content="Numeros Motors - Innovation is our way of life" />
  </head>
  <body>
    <header>
      <a href="https://numerosmotors.com/careers/">Careers</a>
      <a href="/careers">Join Us</a>
    </header>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Numeros Motors | Join the EV Revolution</title>
    <link rel="canonical" href="https://numerosmotors.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h3>Lead the Change with Us</h3>
      <p>
        We are constantly looking to hire candidates across different levels and competencies,
        to strengthen our 250+ team.
      </p>
      <div class="elementor-button-wrapper">
        <a class="elementor-button elementor-size-sm" href="/open-positions">
          <span class="elementor-button-text">Click to See Open Positions &amp; Apply</span>
        </a>
      </div>
    </main>
  </body>
</html>
`

const officialOpenPositionsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Positions at Numeros Motors | Join the EV Revolution</title>
    <link rel="canonical" href="https://numerosmotors.com/open-positions/" />
  </head>
  <body>
    <main>
      <h1>Open Positions</h1>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Senior Engineer - Embedded Hardware</span>
            </h4>
            <p class="elementor-icon-box-description">04--06 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Manager - Sales (Chennai)</span>
            </h4>
            <p class="elementor-icon-box-description">08--12 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Applied Research Engineer- Electrical &amp; Electronics (Advanced Engineering &amp; Research)</span>
            </h4>
            <p class="elementor-icon-box-description">00--05 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Intern - Marketing</span>
            </h4>
            <p class="elementor-icon-box-description">0 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Lead - IP &amp; Strategy</span>
            </h4>
            <p class="elementor-icon-box-description">10--15 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Lead - IP &amp; Strategy</span>
            </h4>
            <p class="elementor-icon-box-description">10 - 14 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>

      <div class="elementor-element elementor-widget elementor-widget-icon-box">
        <div class="elementor-widget-container">
          <div class="elementor-icon-box-content">
            <h4 class="elementor-icon-box-title">
              <span>Senior Manager -Sales ( Kerala )</span>
            </h4>
            <p class="elementor-icon-box-description">10 - 12 Year of Exp.</p>
          </div>
        </div>
      </div>
      <div class="elementor-element popmake-14016 elementor-widget elementor-widget-button">
        <div class="elementor-widget-container">
          <div class="elementor-button-wrapper">
            <a class="elementor-button elementor-size-sm" role="button">
              <span class="elementor-button-text">Apply Now</span>
            </a>
          </div>
        </div>
      </div>
    </main>

    <script>
      var pum_popups = {"pum-14016":{"id":14016,"slug":"career-form"}};
    </script>
  </body>
</html>
`

test('Numeros legacy brief cards preserve title/experience parsing without inferring India or inventing full criteria',async()=>{
 const m=await loadNumerosMotorsModule()
 assert.equal(m.hasOfficialHomepageSignal(officialHomepageHtml),true)
 assert.equal(m.extractCareersUrlFromHomepage(officialHomepageHtml),m.CAREERS_URL)
 assert.equal(m.hasOfficialCareersSignal(officialCareersHtml),true)
 assert.equal(m.extractOpenPositionsUrl(officialCareersHtml),m.OPEN_POSITIONS_URL)
 assert.equal(m.hasOfficialOpenPositionsSignal(officialOpenPositionsHtml),true)
 const rows=m.extractOpenings(officialOpenPositionsHtml)
 assert.equal(rows.length,6)
 assert.deepEqual(rows.map(r=>r.title),['Senior Engineer - Embedded Hardware','Manager - Sales (Chennai)','Applied Research Engineer - Electrical & Electronics (Advanced Engineering & Research)','Intern - Marketing','Lead - IP & Strategy','Senior Manager - Sales (Kerala)'])
 assert.equal(rows[0].experienceRequired,'04-06 Year of Exp.');assert.equal(rows[4].experienceRequired,'10-15 Year of Exp.');assert.equal(rows[3].employmentType,'Internship')
 for(const row of rows){assert.equal(row.country,null);assert.equal(row.city,null);assert.equal(row.location,null);assert.equal(row.jobDescription,null);assert.equal(row.sourceDetailComplete,false);assert.equal(row.lifecycleCleanupAllowed,false)}
})
test('Numeros body-only legacy surface cannot publish title/experience summaries as India jobs',async()=>{
 const m=await loadNumerosMotorsModule();let calls=0
 await assert.rejects(m.createNumerosMotorsScraper({now:()=> '2026-07-11T09:30:00.000Z'}).run({fetchText:async url=>{calls++;return url===m.HOMEPAGE_URL?officialHomepageHtml:url===m.CAREERS_URL?officialCareersHtml:officialOpenPositionsHtml}}),/original HTTP metadata|body-only/i)
 assert.equal(calls,0)
})
test('Numeros pure legacy extractor still rejects an unrelated page',async()=>{
 const m=await loadNumerosMotorsModule();assert.throws(()=>m.extractOpenings('<html><title>Contact</title></html>'),/verified open positions page/)
})
