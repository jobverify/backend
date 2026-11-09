import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const DOODLEBLUE_INNOVATION_CATALOG = {
  source: 'doodleblueinnovation',
  companyName: 'doodleblue innovation',
  officialBrandName: 'doodleblue Innovations Pvt. Ltd.',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  companyCareerPage: 'https://www.doodleblue.com/careers/openings/',
  companyDomain: 'doodleblue.com',
  atsPlatform: 'first-party-openings-page',
  countryFilter: 'India',
  paginationStrategy: 'single-first-party-openings-page',
  extractionStrategy:
    'first-party-role-rows-or-legacy-opening-cards+shared-meta-line+company-hosted-detail-route-or-shared-apply-route-extraction',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-08-02',
  verifiedSurfaceSummary:
    'Verified on Sunday, August 2, 2026 that https://www.doodleblue.com/careers/openings/ is doodleblue innovation\'s live first-party openings page and that the public HTML currently lists six role headings with shared Chennai, India / Full time / experienced metadata plus company-hosted detail routes under /careers/openings/view/, including Full stack Developer (Reactjs+Nodejs) 2+ years, React Native Developer 3+ years, and Project Managers 3+ years.',
}

export default DOODLEBLUE_INNOVATION_CATALOG
