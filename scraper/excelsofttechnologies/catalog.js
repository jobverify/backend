import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const EXCELSOFT_TECHNOLOGIES_CATALOG = {
  source: 'excelsofttechnologies',
  companyName: 'ExcelSoft Technologies',
  officialBrandName: 'Excelsoft Technologies',
  adapter: 'script',
  companyCareerPage: 'https://www.excelsoftcorp.com/career/',
  companyDomain: 'excelsoftcorp.com',
  atsPlatform: 'official-company-site-no-public-openings',
  countryFilter: 'India',
  paginationStrategy: 'single-careers-landing-page-validation',
  extractionStrategy: 'verified-careers-landing-page+no-public-openings-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that Excelsoft Technologies still used the first-party careers landing page at https://www.excelsoftcorp.com/career/, that the page remained a branding surface headed "One Team One Dream" and "Being an Excelian is just a choice away!", and that the embedded Zoho Recruit widget was configured with empty_job_msg "No current Openings" rather than exposing public apply links or enumerable openings.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default EXCELSOFT_TECHNOLOGIES_CATALOG
