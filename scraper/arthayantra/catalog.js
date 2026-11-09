import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ARTHAYANTRA_CATALOG = {
  source: 'arthayantra',
  companyName: 'ArthaYantra',
  officialBrandName: 'ARTHOS Financial Planning',
  legalEntityName: 'Arthayantra Corp. Pvt. Ltd.',
  adapter: 'script',
  companyCareerPage: 'https://www.arthayantra.com/',
  homepageRedirectUrl: 'https://arthos.arthayantra.com/login.html',
  companyDomain: 'arthayantra.com',
  robotsTxtUrl: 'https://arthayantra.com/robots.txt',
  sitemapUrl: 'https://arthayantra.com/sitemap.xml',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'homepage-redirect-plus-sitemap-plus-broken-careers-route-validation',
  extractionStrategy:
    'verified-homepage-login-redirect+verified-sitemap+verified-broken-robots-and-careers-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that https://www.arthayantra.com/ redirects to the live first-party login surface at https://arthos.arthayantra.com/login.html, whose public HTML is an ARTHOS Financial Planning login/signup page rather than a recruiting surface. Also verified that https://arthayantra.com/sitemap.xml is still live and advertises legacy marketing and career URLs including https://www.arthayantra.com/financial-consultant-careers/, https://www.arthayantra.com/career-fa/, and https://www.arthayantra.com/career-fp/, while https://arthayantra.com/robots.txt, https://arthayantra.com/careers, https://arthayantra.com/career, https://arthayantra.com/jobs, https://arthayantra.com/join-us, https://arthayantra.com/work-with-us, https://arthayantra.com/openings, and those three sitemap-advertised career URLs all returned first-party 500 WordPress critical error pages during live checks. There is no trustworthy public jobs surface on the first-party ArthaYantra domain.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default ARTHAYANTRA_CATALOG
