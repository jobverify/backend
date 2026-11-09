import { extractGoogleJobDetail, extractRubrikJobDetail } from './custom.js'
import { extractWorkdayJobDetail } from './workday.js'

const EMPTY_DETAIL = {
  jobDescription: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  experienceRequired: null,
  publicExperienceChecked: false,
  postingDate: null,
  department: null,
  requisitionId: null,
}

const PROVIDERS = {
  workday: extractWorkdayJobDetail,
  google: extractGoogleJobDetail,
  rubrik: extractRubrikJobDetail,
}

export const extractJobDetail = async ({ provider, html }) => {
  const extractor = PROVIDERS[provider]
  if (!extractor) {
    return { ...EMPTY_DETAIL }
  }

  return {
    ...EMPTY_DETAIL,
    ...extractor(html),
  }
}
