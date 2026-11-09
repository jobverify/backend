import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SATVAT_INFOSOL_CATALOG = {
  source: 'satvatinfosol',
  companyName: 'Satvat Infosol',
  officialBrandName: 'Satvat Infosol Private Limited',
  adapter: 'script',
  homepageUrl: 'https://satvatinfosol.com/',
  companyCareerPage: 'https://satvatinfosol.com/Careers.php',
  atsPlatform: 'official-company-careers-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-careers-page',
  extractionStrategy: 'verified-first-party-careers-page+inline-job-cards+shared-apply-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'satvatinfosol.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://satvatinfosol.com/Careers.php was the live first-party Life @ Satvat Infosol openings page and that it publicly listed Chennai roles including Technical Support Trainee, Software Programmer/Developer, Business Development Manager, and Flutter Developer, each handing applicants to the shared first-party apply form at https://satvatinfosol.com/apply_frm.php.',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'satvatinfosol/jobs.json',
}

export default SATVAT_INFOSOL_CATALOG
