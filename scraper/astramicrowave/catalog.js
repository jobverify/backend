import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ASTRA_MICROWAVE_CATALOG = {
  source: 'astramicrowave',
  companyName: 'Astra Microwave',
  officialBrandName: 'Astra Microwave Products Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://astramwp.com/post-resume/',
  homepageUrl: 'https://www.astramwp.com/',
  careersAliasUrl: 'https://astramwp.com/post-resume-2/',
  robotsTxtUrl: 'https://www.astramwp.com/robots.txt',
  sitemapIndexUrl: 'https://astramwp.com/wp-sitemap.xml',
  pageSitemapUrl: 'https://astramwp.com/wp-sitemap-posts-page-1.xml',
  careersSectionPageUrls: [
    'https://astramwp.com/our-culture/',
    'https://astramwp.com/learning-development/',
    'https://astramwp.com/post-resume/',
    'https://astramwp.com/post-resume-2/',
  ],
  applicationEmail: 'hr@astramwp.com',
  applicationUrl: 'mailto:hr@astramwp.com',
  blockedJobRouteUrls: [
    'https://www.astramwp.com/careers',
    'https://www.astramwp.com/career',
    'https://www.astramwp.com/jobs',
    'https://www.astramwp.com/join-us',
    'https://www.astramwp.com/openings',
  ],
  missingJobRouteUrls: [
    'https://www.astramwp.com/work-with-us',
  ],
  companyDomain: 'astramwp.com',
  atsPlatform: 'official-company-careers-nonlisting',
  countryFilter: 'India',
  paginationStrategy: 'verified-robots-and-wordpress-page-sitemap-plus-resume-only-careers-pages-and-adjacent-route-validation',
  extractionStrategy:
    'verified-robots-and-sitemaps+verified-post-resume-pages-without-public-listings+verified-blocked-and-missing-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.astramwp.com/ is the live first-party Astra Microwave homepage domain, although the homepage currently resolves to a first-party GoDaddy/Sucuri 403 Access Denied shell after the JavaScript firewall challenge. Public crawl signals remain available at https://www.astramwp.com/robots.txt, https://astramwp.com/wp-sitemap.xml, and https://astramwp.com/wp-sitemap-posts-page-1.xml, and that page sitemap lists the careers-section URLs https://astramwp.com/our-culture/, https://astramwp.com/learning-development/, https://astramwp.com/post-resume/, and https://astramwp.com/post-resume-2/. The verified first-party careers pages at https://astramwp.com/post-resume/ and https://astramwp.com/post-resume-2/ are resume-upload forms that reference hr@astramwp.com and do not expose public job listings, while https://www.astramwp.com/careers, https://www.astramwp.com/career, https://www.astramwp.com/jobs, https://www.astramwp.com/join-us, and https://www.astramwp.com/openings all returned 403 Access Denied responses and https://www.astramwp.com/work-with-us returned a first-party 404 page. There is no trustworthy public jobs surface on the official first-party domain.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ASTRA_MICROWAVE_CATALOG
