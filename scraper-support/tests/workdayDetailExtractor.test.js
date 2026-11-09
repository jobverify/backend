import assert from 'node:assert/strict'
import test from 'node:test'

import { extractWorkdayJobDetail } from '../detailExtractors/workday.js'

test('extractWorkdayJobDetail prefers real desired experience over company-history years in Workday JSON-LD', () => {
  const html = `
    <html>
      <body>
        <script type="application/ld+json">
          {
            "@type": "JobPosting",
            "description": "Who are we and what do we do? BrowserStack is the world’s leading cloud-based software testing platform. Recognized for its innovation and growth, BrowserStack has been named to the Forbes Cloud 100 list for four consecutive years. Desired Experience: 6+ years of hands-on and strategic SEO experience, preferably in SaaS or B2B category."
          }
        </script>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.experienceRequired, '6+ years')
})

test('extractWorkdayJobDetail ignores employer-tenure prose when a later Workday experience range is present', () => {
  const html = `
    <html>
      <body>
        <script type="application/ld+json">
          {
            "@type": "JobPosting",
            "description": "At Allstate, great things happen when our people work together to protect families and their belongings from life’s uncertainties. And for more than 90 years, our innovative drive has kept us a step ahead of our customers’ evolving needs. Job Description RESPONSIBILITIES: Support claims workflows. Experience 1-4 years experience (Preferred)."
          }
        </script>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.experienceRequired, '1-4 years')
})

test('extractWorkdayJobDetail preserves mixed month-to-year experience ranges from Workday descriptions', () => {
  const html = `
    <html>
      <body>
        <script type="application/ld+json">
          {
            "@type": "JobPosting",
            "description": "Who are we and what do we do? BrowserStack is the world’s leading cloud-based software testing platform. Recognized for its innovation and growth, BrowserStack has been named to the Forbes Cloud 100 list for four consecutive years. Preferred Qualifications: 5 months - 2 years of Sales/Business Development experience with B2B corporate sales experience."
          }
        </script>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.experienceRequired, '5 months - 2 years')
})

test('extractWorkdayJobDetail captures contextual month ranges from Workday descriptions', () => {
  const html = `
    <html>
      <body>
        <script type="application/ld+json">
          {
            "@type": "JobPosting",
            "description": "Education and Experience 0-18 months of related experience. Bachelor’s degree or equivalent experience."
          }
        </script>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.experienceRequired, '0-18 months')
})

test('extractWorkdayJobDetail captures Workday posted-on text from the detail header', () => {
  const html = `
    <html>
      <body>
        <div data-automation-id="postedOn">
          <dl>
            <dt>posted on</dt>
            <dd>Posted 30+ Days Ago</dd>
          </dl>
        </div>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.postingDate, 'Posted 30+ Days Ago')
})

test('extractWorkdayJobDetail falls back to Workday JSON-LD datePosted when the visible posted-on block is absent', () => {
  const html = `
    <html>
      <body>
        <script type="application/ld+json">
          {
            "@type": "JobPosting",
            "datePosted": "2026-06-12",
            "description": "Required Experience Five to ten years of experience as Gold Loan sales in Bank/NBFC"
          }
        </script>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.postingDate, '2026-06-12')
  assert.equal(detail.experienceRequired, '5-10 years')
})

test('extractWorkdayJobDetail infers experience from the visible Workday description body when qualification blocks are absent', () => {
  const html = `
    <html>
      <body>
        <section data-automation-id="jobPostingDescription">
          <div>
            <p>Experience and Requirements:</p>
            <p>Minimum Qualifications BS degree in Information Technology/Computer Science or equivalent combination of education and experience.</p>
            <p>2 years of demonstrated experience in ServiceNow development, administration, or configuration.</p>
          </div>
        </section>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.experienceRequired, '2 years')
  assert.equal(detail.publicExperienceChecked, true)
})

test('extractWorkdayJobDetail marks public Workday detail pages as checked when they expose job detail but no experience years', () => {
  const html = `
    <html>
      <body>
        <section data-automation-id="jobPostingDescription">
          <div>
            <p>Build strong customer relationships for enterprise banking products.</p>
            <p>Collaborate with internal stakeholders to improve customer outcomes.</p>
          </div>
        </section>
        <dl>
          <dt>Department</dt>
          <dd>Sales Group</dd>
        </dl>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.publicExperienceChecked, true)
})

test('extractWorkdayJobDetail preserves bounded year ranges from Workday qualification prose', () => {
  const html = `
    <html>
      <body>
        <script type="application/ld+json">
          {
            "@type": "JobPosting",
            "description": "Position: Senior Engineer - Data Engineer Job Description: Build real-time cloud software systems. Qualifications: 2-5 years of experience in data engineering, ETL pipelines, and cloud analytics. Location: IN-GJ-Ahmedabad, India (eInfochips) Time Type: Full time Job Category: Engineering Services"
          }
        </script>
      </body>
    </html>
  `

  const detail = extractWorkdayJobDetail(html)

  assert.equal(detail.experienceRequired, '2-5 years')
})
