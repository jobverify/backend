import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INNOVAPPTIVE_CATALOG = {
  source: 'innovapptive',
  companyName: 'Innovapptive',
  officialBrandName: 'Innovapptive',
  adapter: 'script',
  homepageUrl: 'https://www.innovapptive.com/',
  companyCareerPage: 'https://www.innovapptive.com/company/careers',
  boardUrl: 'https://innovapptive.applytojob.com/apply',
  atsPlatform: 'official-careers-page-plus-applytojob-board',
  countryFilter: 'India',
  paginationStrategy: 'single-page',
  extractionStrategy: 'html-board',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'innovapptive.com',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://www.innovapptive.com/company/careers remained the live first-party Innovapptive careers page and that the public ApplyToJob board at https://innovapptive.applytojob.com/apply exposed current India openings including AI Platform Lead, Associate Solution Consultant - EAM, and Support Manager. Also verified mixed-region remote roles on the board, so the scraper must confirm each listing location from its job-detail page before keeping it under the India filter.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default INNOVAPPTIVE_CATALOG
