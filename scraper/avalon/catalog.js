import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const AVALON_CATALOG = {
  source: 'avalon',
  companyName: 'Avalon',
  officialBrandName: 'Avalon Information Systems',
  legalEntityName: 'Avalon Information Systems Pvt. Ltd. (AISPL)',
  adapter: 'script',
  companyCareerPage: 'https://www.avaloninfosys.com/career',
  homepageUrl: 'https://www.avaloninfosys.com/',
  careerAliasUrl: 'https://www.avaloninfosys.com/index.php/career',
  legacyCareersPageUrl: 'https://www.avaloninfosys.com/careers',
  applicationEmail: 'jobs@avaloninfosys.com',
  noPublicJobRouteUrls: [
    'https://www.avaloninfosys.com/jobs',
    'https://www.avaloninfosys.com/join-us',
    'https://www.avaloninfosys.com/work-with-us',
  ],
  verifiedVacancyDetailUrls: [
    'https://www.avaloninfosys.com/vacancies/executive-assistant',
    'https://www.avaloninfosys.com/vacancies/accounts-executive',
    'https://www.avaloninfosys.com/vacancies/ui-ux-internship',
    'https://www.avaloninfosys.com/vacancies/programme-manager',
    'https://www.avaloninfosys.com/vacancies/software-engineer-internship-programme',
  ],
  companyDomain: 'avaloninfosys.com',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-single-career-table-plus-first-party-vacancy-detail-pages',
  extractionStrategy:
    'verified-homepage+verified-career-table+verified-first-party-vacancy-detail-pages+inline-application-form',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-28',
  verifiedSurfaceSummary:
    'Verified on July 28, 2026 that https://www.avaloninfosys.com/ is the live first-party Avalon Information Systems homepage for the backlog company name Avalon and links directly to the trusted public jobs surface at https://www.avaloninfosys.com/career. The same vacancy-table surface is also available at https://www.avaloninfosys.com/index.php/career, and verified first-party vacancy detail pages include https://www.avaloninfosys.com/vacancies/executive-assistant, https://www.avaloninfosys.com/vacancies/accounts-executive, https://www.avaloninfosys.com/vacancies/ui-ux-internship, https://www.avaloninfosys.com/vacancies/programme-manager, and https://www.avaloninfosys.com/vacancies/software-engineer-internship-programme. The separate https://www.avaloninfosys.com/careers page now carries refreshed first-party careers marketing copy and accordion-style opening teasers, but the trusted vacancy-table listings and detail pages remain rooted on /career and /index.php/career, while https://www.avaloninfosys.com/jobs, https://www.avaloninfosys.com/join-us, and https://www.avaloninfosys.com/work-with-us still return first-party 404 pages during live checks. Applications are routed through the inline first-party form on each vacancy detail page and the careers copy references jobs@avaloninfosys.com.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default AVALON_CATALOG
