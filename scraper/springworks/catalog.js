import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const SPRINGWORKS_CATALOG = {
  source: 'springworks',
  companyName: 'Springworks',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.springworks.in/about-us/',
  companyDomain: 'springworks.in',
  aboutUrl: 'https://www.springworks.in/about-us/',
  jobsUrl: 'https://jobs.goodfit.so/jobs/springworks',
  handoffUrl: 'https://springworks.goodfit.so/careers/springworks',
  atsPlatform: 'goodfit-hosted-jobs',
  countryFilter: 'India',
  paginationStrategy: 'single-ssr-jobs-page',
  extractionStrategy: 'verified-first-party-handoff-plus-goodfit-react-flight-card-parse',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary: 'Tuesday, August 4, 2026: Springworks still linked from its first-party about page to the Goodfit careers handoff. The legacy app.goodfit.so /careers/springworks/jobs route returned 404, but the trusted public jobs surface had moved to https://jobs.goodfit.so/jobs/springworks, which exposed five live remote role cards including "Software Development Engineer in Test Intern", "Sales/ SDR Intern", and "Customer Success Associate".',
}

export default SPRINGWORKS_CATALOG
