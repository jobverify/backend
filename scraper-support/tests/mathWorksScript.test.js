import assert from 'node:assert/strict'
import test from 'node:test'

const loadMathworksModule = async () => {
  try {
    return await import('../../scraper/mathworks/script.js')
  } catch {
    assert.fail('Expected MathWorks scraper module at ../../scraper/mathworks/script.js')
  }
}

const sampleFeedXml = `
<rss version="2.0">
  <channel>
    <item>
      <title>Senior Software Engineer in Test</title>
      <link>https://in.mathworks.com/company/jobs/opportunities/35621-senior-software-engineer-in-test</link>
      <guid>https://in.mathworks.com/company/jobs/opportunities/35621-senior-software-engineer-in-test</guid>
      <category>IN-Bangalore</category>
      <description><![CDATA[Build quality automation for developer tooling.]]></description>
      <pubDate>Thu, 09 Jul 2026 00:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Principal Data Scientist</title>
      <link>https://in.mathworks.com/company/jobs/opportunities/35622-principal-data-scientist</link>
      <guid>https://in.mathworks.com/company/jobs/opportunities/35622-principal-data-scientist</guid>
      <category>US-Natick</category>
      <description><![CDATA[Lead advanced analytics in the US.]]></description>
      <pubDate>Thu, 09 Jul 2026 00:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>
`

const sampleDetailHtml = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Senior Software Engineer in Test",
  "description": "<p>Build resilient automation frameworks for MathWorks desktop and cloud products.</p>",
  "datePosted": "2026-07-09",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "MathWorks"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Bangalore",
      "addressRegion": "Karnataka",
      "addressCountry": "IN"
    }
  }
}
</script>
`

test('MathWorks constants stay pinned to the verified public careers and RSS surfaces', async () => {
  const mathworks = await loadMathworksModule()

  assert.equal(mathworks.CAREER_PAGE_URL, 'https://www.mathworks.com/company/jobs/opportunities.html')
  assert.equal(mathworks.INDIA_SEARCH_URL, 'https://in.mathworks.com/company/jobs/opportunities/search?keywords=&location%5B%5D=430')
  assert.equal(mathworks.RSS_FEED_URL, 'https://in.mathworks.com/company/jobs/opportunities/rss.xml')
  assert.equal(mathworks.COMPANY, 'MathWorks')
  assert.equal(mathworks.SOURCE, 'mathworks')
})

test('extractJobsFromFeed keeps only India MathWorks jobs from the official RSS feed', async () => {
  const mathworks = await loadMathworksModule()

  assert.deepEqual(mathworks.extractJobsFromFeed(sampleFeedXml), [
    {
      title: 'Senior Software Engineer in Test',
      company: 'MathWorks',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '35621',
      requisitionId: '35621',
      sourceUrl: 'https://in.mathworks.com/company/jobs/opportunities/35621-senior-software-engineer-in-test',
      applyUrl: 'https://in.mathworks.com/company/jobs/opportunities/35621-senior-software-engineer-in-test',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-09T00:00:00.000Z',
      closingDate: null,
      jobDescription: 'Build quality automation for developer tooling.',
    },
  ])
})

test('extractJobDetail enriches MathWorks detail pages from public JobPosting JSON-LD', async () => {
  const mathworks = await loadMathworksModule()

  assert.deepEqual(mathworks.extractJobDetail(sampleDetailHtml), {
    title: 'Senior Software Engineer in Test',
    company: 'MathWorks',
    location: 'Bangalore, Karnataka, India',
    city: 'Bangalore',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-07-09',
    jobDescription: 'Build resilient automation frameworks for MathWorks desktop and cloud products.',
  })
})

test('run fetches the public MathWorks RSS feed, enriches detail pages, and decorates shared runner fields', async () => {
  const mathworks = await loadMathworksModule()
  const requestedUrls = []

  const jobs = await mathworks.createMathworksScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === mathworks.RSS_FEED_URL) return sampleFeedXml
      if (url === 'https://in.mathworks.com/company/jobs/opportunities/35621-senior-software-engineer-in-test') {
        return sampleDetailHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-09T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://in.mathworks.com/company/jobs/opportunities/rss.xml',
    'https://in.mathworks.com/company/jobs/opportunities/35621-senior-software-engineer-in-test',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'mathworks')
  assert.equal(
    jobs[0].link,
    'https://in.mathworks.com/company/jobs/opportunities/35621-senior-software-engineer-in-test',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-09T00:00:00.000Z')
})
