import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://ellenbarrie.com/ is the live first-party homepage for Ellenbarrie Industrial Gases and links candidates to the first-party career page at https://ellenbarrie.com/career/. Verified that https://ellenbarrie.com/career/ is a generic first-party recruiting page titled "Career - Ellenbarrie" with the headings "Join Our Team", "Why Work with Us?", and "Opportunities Await!", plus a Contact Form 7 application form using the fields candidate_name, sender_mail, your_phoneno, and select_file, alongside info@ellenbarrie.com. Verified that https://ellenbarrie.com/robots.txt advertises https://ellenbarrie.com/wp-sitemap.xml, that the sitemap is a WordPress sitemap index, and that the adjacent public routes https://ellenbarrie.com/careers, https://ellenbarrie.com/jobs, https://ellenbarrie.com/join-us, and https://ellenbarrie.com/work-with-us returned 404 during live checks. The trusted public surface is therefore a generic first-party application page with no public job titles, job detail pages, or JobPosting markup.'

export const ELLENBARRIE_INDUSTRIAL_GASES_CATALOG = {
  source: 'ellenbarrieindustrialgases',
  companyName: 'Ellenbarrie Industrial Gases',
  officialBrandName: 'Ellenbarrie',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'ellenbarrieindustrialgases/jobs.json',
  homepageUrl: 'https://ellenbarrie.com/',
  companyCareerPage: 'https://ellenbarrie.com/career/',
  robotsTxtUrl: 'https://ellenbarrie.com/robots.txt',
  sitemapUrl: 'https://ellenbarrie.com/sitemap.xml',
  applicationEmail: 'info@ellenbarrie.com',
  companyDomain: 'ellenbarrie.com',
  atsPlatform: 'official-company-careers-generic-form-no-public-openings',
  countryFilter: 'India',
  paginationStrategy:
    'homepage-plus-generic-career-form-plus-missing-common-job-routes-plus-robots-sitemap-validation',
  extractionStrategy:
    'verified-homepage-career-link+verified-generic-career-page-form-without-public-openings+verified-robots-and-sitemap+verified-missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ELLENBARRIE_INDUSTRIAL_GASES_CATALOG
