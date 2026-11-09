import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.apeximports.com/ is the live first-party Apex Imports homepage, currently a moved landing page that routes visitors to Hanna Imports and Sanford Imports rather than a jobs board. Also verified that https://www.apeximports.com/robots.txt does not advertise any careers surface, while https://www.apeximports.com/sitemap.xml, https://www.apeximports.com/careers, https://www.apeximports.com/career, https://www.apeximports.com/jobs, https://www.apeximports.com/join-us, https://www.apeximports.com/work-with-us, and https://www.apeximports.com/openings returned missing-route responses during live checks. There is no trustworthy public jobs surface on the first-party Apex Imports domain.'

export const APEX_IMPORTS_CATALOG = {
  source: 'apeximports',
  companyName: 'Apex Imports',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: 'https://www.apeximports.com/',
  homepageUrl: 'https://www.apeximports.com/',
  robotsTxtUrl: 'https://www.apeximports.com/robots.txt',
  sitemapUrl: 'https://www.apeximports.com/sitemap.xml',
  careersRouteUrls: [
    'https://www.apeximports.com/careers',
    'https://www.apeximports.com/career',
    'https://www.apeximports.com/jobs',
    'https://www.apeximports.com/join-us',
    'https://www.apeximports.com/work-with-us',
    'https://www.apeximports.com/openings',
  ],
  companyDomain: 'apeximports.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-moved-homepage-plus-robots-plus-missing-careers-route-validation',
  extractionStrategy: 'verified-moved-homepage+verified-robots-txt+verified-missing-careers-and-sitemap-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default APEX_IMPORTS_CATALOG
