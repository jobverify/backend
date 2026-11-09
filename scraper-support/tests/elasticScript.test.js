import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import {
  buildApplyUrl,
  buildIndiaApiUrl,
  buildJobUrl,
  extractSearchResults,
} from '../../scraper/elastic/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'elastic',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('Elastic URL builders stay on the first-party careers domain', () => {
  assert.equal(
    buildIndiaApiUrl(),
    'https://jobs.elastic.co/api/filter/jobs?groupId=1509&column=country&value=India&groupBy=city',
  )
  assert.equal(
    buildJobUrl('sales/delhi-india/account-executive-public-sector/7831596', '7831596'),
    'https://jobs.elastic.co/jobs/sales/delhi-india/account-executive-public-sector/7831596?gh_jid=7831596',
  )
  assert.equal(
    buildApplyUrl('7831596'),
    'https://jobs.elastic.co/jobs?gh_jid=7831596',
  )
})

test('extractSearchResults flattens Elastic India jobs from the grouped city API payload', () => {
  const payload = readJsonFixture('country-india.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 10)
  assert.deepEqual(jobs[0], {
    title: 'Account Executive - Public Sector',
    company: 'Elastic',
    department: 'Field Operations',
    location: 'Delhi, India',
    city: 'Delhi',
    jobId: '7831596',
    requisitionId: 'R11529',
    sourceUrl: 'https://jobs.elastic.co/jobs/sales/delhi-india/account-executive-public-sector/7831596?gh_jid=7831596',
    applyUrl: 'https://jobs.elastic.co/jobs?gh_jid=7831596',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-04-28T05:05:19.000000Z',
    closingDate: null,
    jobDescription: 'Elastic, the Search AI Company, enables everyone to find the answers they need in real time, using all their data, at scale - unleashing the potential of businesses and people. The Elastic Search AI Platform, used by more than 50% of the Fortune 500, brings together the precision of search and the intelligence of AI to enable everyone to accelerate the results that matter. By taking advantage of all structured and unstructured data - securing and protecting private information more effectively - Elastic\'s complete, cloud-based solutions for search, security, and observability help organizations deliver on the promise of AI. What is The Role: Elastic is searching for an Enterprise Account Executive (SLEDH) to expand our business in States (primarily focused on northern and eastern part of India) along with Education & Healthcare accounts. Our Enterprise Account Executives are individual contributors, passionate about building new business and growing the Elastic footprint within their set of accounts. Are you ready to help users tackle their hardest data problems through the power of search? If so, we\'d love to hear from you! What You Will Be Doing: Building awareness and driving demand for Elastic solutions within States & EDU & Healthcare accounts by helping users and customers derive value from their data sets. Serving as an evangelist for our Open-Source offerings while communicating and demonstrating the capabilities of our commercial features Uncovering new and diverse use cases to enable our users to work smarter, not harder Collaborating across Elastic business functions to ensure a seamless customer experience Working thoughtfully with customers to identify new business opportunities, managing through the sales cycle and closing complex transactions Building a robust business plan through community, customer and partner ecosystems to achieve significant Elastic growth within your accounts What You Bring: A track record of success in selling Software/Security Solutions/SaaS subscriptions into net new complex accounts, demonstrated by overachievement of quota and strong customer references A deep understanding and preferably experience selling into the ecosystem we live in, including Enterprise Search, Logging, Security, APM and Cloud The ability to build relationships and credibility with both Developers and Executives Predictability and accurate forecasting capabilities using SFDC An appreciation for the Open Source go-to-market model and the community of users who rely on our solutions every single day Previous experience selling into the Enterprise accounts included in this territory Bonus Points: Previous experience selling in an Open Source model Additional Information - We Take Care of Our People: As a distributed company, diversity drives our identity. Whether you\'re looking to launch a new career or grow an existing one, Elastic is the type of company where you can balance great work with great life. Your age is only a number. It doesn\'t matter if you\'re just out of college or your children are; we need you for what you can do. We strive to have parity of benefits across regions, and while regulations differ from place to place, we believe taking care of our people is the right thing to do. Competitive pay based on the work you do here and not your previous salary Health coverage for you and your family in many locations Ability to craft your calendar with flexible locations and schedules for many roles Generous number of vacation days each year Increase your impact - We match up to $2000 (or local currency equivalent) for financial donations and service Up to 40 hours each year to use toward volunteer projects you love Embracing parenthood with a minimum of 16 weeks of parental leave Different people approach problems differently. We need that. Elastic is an equal opportunity employer and is committed to creating an inclusive culture that celebrates different perspectives, experiences, and backgrounds. Qualified applicants will receive consideration for employment without regard to race, ethnicity, color, religion, sex, pregnancy, sexual orientation, gender perception or identity, national origin, age, marital status, protected veteran status, disability status, or any other basis protected by federal, state or local law, ordinance or regulation. We welcome individuals with disabilities and strive to create an accessible and inclusive experience for all individuals. To request an accommodation during the application or the recruiting process, please email candidate_accessibility@elastic.co. We will reply to your request within 24 business hours of submission. Applicants have rights under Federal Employment Laws and can view the following posters linked below: Family and Medical Leave Act (FMLA) Poster Employee Polygraph Protection Act (EPPA) Poster Elasticsearch develops and distributes technology and information that is subject to U.S. and other countries\' export controls and licensing requirements for individuals who are located in or are nationals of the following sanctioned countries and regions: Belarus, Cuba, Iran, North Korea, Syria, or Russia, including the Ukrainian territories annexed by Russia (The Crimea region of Ukraine, The Donetsk People\'s Republic (DNR), The Luhansk People\'s Republic (LNR), Kherson or Zaporizhzhia). If you are located in or are a national of one of the listed countries or regions, an export license may be required as a condition of your employment in this role. Please note that national origin and/or nationality do not affect eligibility for employment with Elastic. Please see here for our Privacy Statement. #LI-AS3',
  })

  assert.deepEqual(jobs[5], {
    title: 'Consulting Architect - Observability',
    company: 'Elastic',
    department: 'Customer Success Group',
    location: 'India',
    city: 'Distributed',
    jobId: '7447246',
    requisitionId: '2872',
    sourceUrl: 'https://jobs.elastic.co/jobs/csg/india/consulting-architect-observability/7447246?gh_jid=7447246',
    applyUrl: 'https://jobs.elastic.co/jobs?gh_jid=7447246',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-12-05T14:05:26.000000Z',
    closingDate: null,
    jobDescription: jobs[5].jobDescription,
  })

  assert.match(jobs[5].jobDescription, /Elastic, the Search AI Company/i)
  assert.doesNotMatch(jobs[5].jobDescription, /<p>|<li>|<h4>/i)
})

test('normalizeScrapedJob derives stable Elastic metadata from the grouped India payload', () => {
  const payload = readJsonFixture('country-india.json')
  const jobs = extractSearchResults(payload)

  const normalized = normalizeScrapedJob(jobs[5], {
    source: 'elastic',
    companyName: 'Elastic',
    companyCareerPage: 'https://www.elastic.co/careers',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(normalized.company, 'Elastic')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.city, 'Distributed')
  assert.equal(normalized.department, 'Customer Success Group')
  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.jobType, 'Full-time Experienced')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.companyDomain, 'elastic.co')
})
