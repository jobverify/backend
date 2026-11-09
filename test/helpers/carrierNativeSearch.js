// The October 21 recordings predate live search discovery. Model the active
// h2/location anchor shape captured on October 31, pointing to their recorded
// public role so the older native inventory regressions remain isolated.
export const carrierSearchPacket = () => ({
  url: 'https://jobs.carrier.com/en/search-jobs?k=India',
  finalURL: 'https://jobs.carrier.com/en/search-jobs?k=India',
  method: 'GET', requestBody: null, status: 200,
  body: '<html><title>Search our Job Opportunities at Carrier</title><body>'
    + '<a href="/en/job/hyderabad/salesforce-developer-with-cpq/29289/101934204896">'
    + '<h2>Salesforce Developer with CPQ</h2><p>Hyderabad, India</p></a></body></html>',
})
