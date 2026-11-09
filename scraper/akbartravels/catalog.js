export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.akbartravels.com/ redirects to the live India homepage at https://www.akbartravels.com/in, that https://www.akbartravels.com/careers resolves to the first-party careers page at https://www.akbartravels.com/in/careers, and that https://www.akbartravels.com/robots.txt plus https://www.akbartravels.com/sitemap.xml are live crawl surfaces listing travel content rather than job listings. There is no trustworthy public jobs surface: the verified careers page is an informational recruiting page that tells applicants to email resumes to hr@akbartravels.com and include the job designation in the subject line, but it exposes no public job cards, job detail pages, ATS handoff, or structured JobPosting markup. Adjacent first-party routes such as https://www.akbartravels.com/career, https://www.akbartravels.com/jobs, https://www.akbartravels.com/join-us, https://www.akbartravels.com/openings, https://www.akbartravels.com/current-openings, https://www.akbartravels.com/in/career, https://www.akbartravels.com/in/jobs, https://www.akbartravels.com/in/join-us, and https://www.akbartravels.com/in/openings returned 403 responses during live checks.'

export const AKBAR_TRAVELS_CATALOG = {
  source: 'akbartravels',
  companyName: 'Akbar Travels',
  adapter: 'script',
  modulePath: '../../scraper/akbartravels/script.js',
  rootUrl: 'https://www.akbartravels.com/',
  homepageUrl: 'https://www.akbartravels.com/in',
  companyCareerPage: 'https://www.akbartravels.com/careers',
  localizedCareersPage: 'https://www.akbartravels.com/in/careers',
  companyDomain: 'akbartravels.com',
  atsPlatform: 'official-company-site-no-public-careers',
  countryFilter: 'India',
  paginationStrategy: 'verified-root-redirect-plus-first-party-careers-copy-plus-missing-common-job-routes',
  extractionStrategy:
    'verified-root-redirect+verified-india-homepage+verified-careers-copy-email-resume-handoff-without-public-listings+verified-missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default AKBAR_TRAVELS_CATALOG

