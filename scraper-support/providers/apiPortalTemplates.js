const deepMerge = (baseValue, overrideValue) => {
  if (overrideValue == null) return baseValue
  if (baseValue == null) return overrideValue

  if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
    return overrideValue
  }

  if (
    typeof baseValue === 'object'
    && typeof overrideValue === 'object'
  ) {
    return Object.fromEntries(
      [...new Set([...Object.keys(baseValue), ...Object.keys(overrideValue)])].map((key) => ([
        key,
        deepMerge(baseValue[key], overrideValue[key]),
      ])),
    )
  }

  return overrideValue
}

const withLocationFilter = (pattern) => (
  pattern
    ? {
        include: [
          {
            field: 'location',
            pattern,
          },
        ],
      }
    : { include: [], exclude: [] }
)

const EIGHTFOLD_BROWSER_HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest',
}

const getUrlOrigin = (value) => {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

const buildEightfoldReferer = ({ templateOptions = {} }) => (
  templateOptions.referer
  || `https://${templateOptions.host}/careers${templateOptions.domain ? `?domain=${templateOptions.domain}` : ''}`
)

const buildEightfoldBrowserHeaders = ({ templateOptions = {} }) => {
  const referer = buildEightfoldReferer({ templateOptions })

  return {
    ...EIGHTFOLD_BROWSER_HEADERS,
    Referer: referer,
    Origin: templateOptions.origin || getUrlOrigin(referer) || `https://${templateOptions.host}`,
  }
}

const API_PORTAL_TEMPLATES = {
  greenhouse: ({ templateOptions = {} }) => ({
    request: {
      method: 'GET',
      query: {
        content: 'true',
      },
    },
    pagination: {
      strategy: 'single-page',
      resultsPath: 'jobs',
      totalCountPath: 'meta.total',
    },
    mapping: {
      title: 'title',
      location: 'location.name',
      jobId: 'id',
      requisitionId: 'requisition_id',
      applyUrl: 'absolute_url',
      department: 'departments.0.name',
      jobDescription: 'content',
      postingDate: 'first_published',
    },
    resultFilter: withLocationFilter(templateOptions.locationPattern),
    discovery: {
      listingApiUrl: `https://boards-api.greenhouse.io/v1/boards/${templateOptions.boardToken}/jobs`,
    },
  }),
  lever: ({ templateOptions = {} }) => ({
    request: {
      method: 'GET',
      query: {
        mode: 'json',
      },
    },
    pagination: {
      strategy: 'single-page',
    },
    mapping: {
      title: 'text',
      location: { strategy: 'lever-location' },
      country: { strategy: 'lever-country' },
      jobId: 'id',
      requisitionId: 'id',
      applyUrl: 'applyUrl',
      sourceUrl: 'hostedUrl',
      department: 'categories.department',
      employmentType: 'categories.commitment',
      jobDescription: { strategy: 'lever-description' },
      postingDate: 'createdAt',
      remoteStatus: { path: 'workplaceType', valueMap: { remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site', 'on-site': 'On-site' } },
    },
    resultFilter: withLocationFilter(templateOptions.locationPattern),
    discovery: {
      listingApiUrl: `https://api.${templateOptions.region === 'eu' ? 'eu.' : ''}lever.co/v0/postings/${templateOptions.boardToken}`,
    },
  }),
  atlassian: ({ templateOptions = {} }) => ({
    request: {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
        'X-Requested-With': 'XMLHttpRequest',
      },
    },
    pagination: {
      strategy: 'single-page',
    },
    mapping: {
      title: 'title',
      location: 'locations.0',
      jobId: 'id',
      requisitionId: 'id',
      sourceUrl: {
        strategy: 'template',
        template: 'https://www.atlassian.com/company/careers/details/{{jobId}}',
        values: {
          jobId: 'id',
        },
      },
      applyUrl: 'applyUrl',
      department: 'category',
      employmentType: 'type',
      postingDate: 'portalJobPost.updatedDate',
      jobDescription: {
        strategy: 'template',
        template: '{{overview}}\n\n{{responsibilities}}\n\n{{qualifications}}\n\n{{compensation}}',
        values: {
          overview: 'overview',
          responsibilities: 'responsibilities',
          qualifications: 'qualifications',
          compensation: 'compensation',
        },
      },
      minimumQualification: 'qualifications',
      preferredQualification: 'responsibilities',
    },
    resultFilter: withLocationFilter(templateOptions.locationPattern),
    discovery: {
      listingApiUrl: 'https://www.atlassian.com/endpoint/careers/listings',
    },
  }),
  smartrecruiters: ({ templateOptions = {} }) => ({
    request: {
      method: 'GET',
      query: {
        limit: String(templateOptions.limit || 100),
      },
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: templateOptions.limit || 100,
      offsetParam: 'offset',
      limitParam: 'limit',
      resultsPath: 'content',
      totalCountPath: 'totalFound',
    },
    mapping: {
      title: 'name',
      location: 'location.fullLocation',
      jobId: 'id',
      requisitionId: 'refNumber',
      sourceUrl: 'postingUrl',
      applyUrl: 'applyUrl',
      department: 'department.label',
      employmentType: 'typeOfEmployment.label',
      experienceLevel: 'experienceLevel.label',
      postingDate: 'releasedDate',
    },
    detail: {
      enabled: true,
      urlTemplate: `https://api.smartrecruiters.com/v1/companies/${templateOptions.companySlug}/postings/{{jobId}}`,
      method: 'GET',
      mapping: {
        jobDescription: 'jobAd.sections.jobDescription.text',
        minimumQualification: 'jobAd.sections.qualifications.text',
        preferredQualification: 'jobAd.sections.additionalInformation.text',
      },
    },
    resultFilter: withLocationFilter(templateOptions.locationPattern),
    discovery: {
      listingApiUrl: `https://api.smartrecruiters.com/v1/companies/${templateOptions.companySlug}/postings`,
    },
  }),
  eightfold: ({ templateOptions = {} }) => ({
    request: {
      method: 'GET',
      headers: buildEightfoldBrowserHeaders({ templateOptions }),
      query: {
        domain: templateOptions.domain,
        query: templateOptions.query || '',
        location: templateOptions.location || 'India',
        sort_by: templateOptions.sortBy || 'timestamp',
      },
    },
    pagination: {
      strategy: templateOptions.paginationStrategy || 'offset-limit',
      pageSize: templateOptions.pageSize ?? 50,
      offsetParam: 'start',
      limitParam: 'limit',
      resultsPath: 'data.positions',
      totalCountPath: 'data.count',
    },
    mapping: {
      title: 'name',
      location: templateOptions.locationPath || 'locations.0',
      jobId: 'id',
      requisitionId: 'displayJobId',
      sourceUrl: {
        path: 'data',
        valuePath: 'publicUrl',
      },
      applyUrl: {
        path: 'data',
        valuePath: 'publicUrl',
      },
      department: 'department',
      postingDate: templateOptions.postingDatePath || 'postedTs',
    },
    detail: {
      enabled: true,
      urlTemplate: `https://${templateOptions.host}/api/pcsx/position_details?position_id={{jobId}}&domain=${templateOptions.domain}&hl=en`,
      method: 'GET',
      headers: buildEightfoldBrowserHeaders({ templateOptions }),
      mapping: {
        jobDescription: 'data.jobDescription',
      },
    },
    resultFilter: withLocationFilter(templateOptions.locationPattern),
    discovery: {
      listingApiUrl: `https://${templateOptions.host}/api/pcsx/search`,
    },
  }),
  dover: ({ templateOptions = {} }) => ({
    request: {
      method: 'GET',
    },
    pagination: {
      strategy: 'single-page',
    },
    mapping: {
      title: ['title', 'name'],
      location: [
        {
          path: 'locations',
          valuePath: '0.name',
        },
        'location',
      ],
      jobId: ['id', 'jobId', 'uuid'],
      requisitionId: ['id', 'jobId', 'uuid'],
      sourceUrl: {
        strategy: 'template',
        template: `https://app.dover.com/apply/${templateOptions.applySlug}/{{jobId}}`,
        values: {
          jobId: ['id', 'jobId', 'uuid'],
        },
      },
      applyUrl: {
        strategy: 'template',
        template: `https://app.dover.com/apply/${templateOptions.applySlug}/{{jobId}}`,
        values: {
          jobId: ['id', 'jobId', 'uuid'],
        },
      },
      department: [
        'department.name',
        'department',
        'team.name',
        'team',
      ],
      employmentType: ['employmentType', 'employment_type'],
      postingDate: ['createdAt', 'updatedAt', 'openedAt'],
    },
    detail: {
      enabled: true,
      urlTemplate: 'https://app.dover.com/api/v1/inbound/application-portal-job/{{jobId}}',
      method: 'GET',
      mapping: {
        jobDescription: ['description', 'jobDescription', 'descriptionHtml'],
        minimumQualification: ['minimumQualifications', 'minimumQualification'],
        preferredQualification: ['preferredQualifications', 'preferredQualification'],
        requiredSkills: ['requiredSkills', 'skills'],
      },
    },
    resultFilter: withLocationFilter(templateOptions.locationPattern),
    discovery: {
      listingApiUrl: `https://app.dover.com/api/v1/careers-page/${templateOptions.clientUuid}/jobs`,
    },
  }),
}

export const expandApiPortalProviderTemplate = (provider = {}) => {
  if (!provider.template) return provider

  const templateFactory = API_PORTAL_TEMPLATES[provider.template]
  if (!templateFactory) {
    throw new Error(`Unsupported apiPortal template: ${provider.template}`)
  }

  const templateConfig = templateFactory(provider)

  return {
    ...provider,
    config: deepMerge(templateConfig, provider.config || {}),
  }
}
