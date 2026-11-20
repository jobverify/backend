import { PUBLIC_JOB_TYPE_EXPRESSION } from './publicJobType.js';

const JOB_LIST_CARD_FIELDS = Object.freeze([
  "title",
  "company",
  "location",
  "city",
  "locations",
  "jobType",
  "experienceRequired",
  "primaryRoleDomain",
  "seniority",
  "workArrangement",
  "eligibleBatches",
  "eligibleBatchRange",
  "eligibleBatchesProvenance",
  "branches",
  "postedAt",
  "employerPostedAt",
  "postedAtProvenance",
  "postedAtProvenanceValue",
  "lastSeenAt",
  "closingDate",
  "salary",
  "employerExperienceLevel",
  "employerStreetAddress",
  "requiredSkills",
  "jobSkills",
  "applyUrl",
  "sourceUrl",
  "workdayApplicationStatus",
  "workdayApplicationStatusReason",
  "workdayApplicationStatusCheckedAt",
]);
const JOB_LIST_CURSOR_FIELDS = Object.freeze(["sortDate", "clickCount"]);
const JOB_LIST_QUERY_FIELDS = Object.freeze([
  ...new Set([...JOB_LIST_CARD_FIELDS, ...JOB_LIST_CURSOR_FIELDS, 'classification', 'employmentType', 'experienceLevel',
    'sourceRemoteStatusUnresolved', 'remoteStatus']),
]);
export const JOB_LIST_CARD_PROJECTION = JOB_LIST_QUERY_FIELDS.join(" ");
export const JOB_LIST_CARD_TEXT_PROJECTION = Object.freeze(
  Object.fromEntries(JOB_LIST_QUERY_FIELDS.map((field) => [field, 1])),
);
export const JOB_LIST_CARD_AGGREGATE_PROJECT = { ...JOB_LIST_CARD_TEXT_PROJECTION, _publicJobType: PUBLIC_JOB_TYPE_EXPRESSION };

