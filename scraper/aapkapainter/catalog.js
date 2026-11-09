export const AAPKA_PAINTER_CATALOG = {
  source: 'aapkapainter',
  companyName: 'Aapka Painter',
  companyCareerPage: 'https://aapkapainter.com/career',
  companyDomain: 'aapkapainter.com',
  adapter: 'script',
  atsPlatform: 'official-company-careers-nonlisting',
  countryFilter: 'India',
  paginationStrategy: 'homepage-plus-career-page-widget-validation-and-common-route-validation',
  extractionStrategy: 'verified-homepage+verified-career-page+embedded-zimyo-widget-hook+dead-zimyo-widget-script+missing-common-job-routes-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  modulePath: 'scraper/aapkapainter/script.js',
  verifiedOn: '2026-07-14',
  verifiedSurfaceSummary:
    'Official aapkapainter.com links to a branded first-party /career page that embeds a Zimyo widget hook with USERID 1476, but the referenced widget script currently only redirects to ats.zimyo.work and no trustworthy public job listings surface was exposed on the official page or adjacent first-party job routes.',
  homepageUrl: 'https://aapkapainter.com/',
  widgetScriptUrl: 'https://ats.zimyo.com/assets/js/jobwidget.js',
  widgetUserId: '1476',
}

export default AAPKA_PAINTER_CATALOG
