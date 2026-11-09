import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG = {
  source: 'perpetuuititechnosoftservices',
  companyName: 'Perpetuuiti Technosoft Services',
  officialBrandName: 'Perpetuuiti',
  adapter: 'script',
  homepageUrl: 'https://ptechnosoft.com/',
  companyCareerPage: 'https://ptechnosoft.com/',
  legacyCareersUrl: 'https://perpetuuiti.com/Careers.php',
  legacyApplicationFormUrl: 'https://perpetuuiti.com/Careers-Form.php',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-homepage-plus-sitemap-plus-legacy-careers-redirect-plus-missing-routes',
  extractionStrategy:
    'verified-homepage+verified-sitemap-without-careers-routes+legacy-careers-redirects-to-homepage+verified-missing-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'ptechnosoft.com',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://ptechnosoft.com/ was the live official Perpetuuiti site, that https://www.ptechnosoft.com/sitemap.xml listed the homepage, about page, and contact page but no careers-like route, that the legacy careers URLs https://perpetuuiti.com/Careers.php and https://perpetuuiti.com/Careers-Form.php now redirect to the homepage instead of a jobs surface, and that https://ptechnosoft.com/careers, https://ptechnosoft.com/career, and https://ptechnosoft.com/jobs each returned first-party 404 pages. No trustworthy public first-party jobs surface was exposed on the verified date, so this provider remains fail-closed.',
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default PERPETUUITI_TECHNOSOFT_SERVICES_CATALOG
