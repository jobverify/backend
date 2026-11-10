import { withSourceDescription } from './jobSourceContent.js';
import { mainExperienceRequirement, alternativeExperienceRequirement } from './mainExperienceRequirement.js';
import { JOB_CLASSIFICATION_POLICY_VERSION } from './jobClassificationVersion.js';
import {
  EXPERIENCE_BUCKET_VALUES,
  EXTRACTION_VERSION,
  ROLE_DOMAIN_OPTIONS,
  SENIORITY_LEVELS,
  SKILL_REGISTRY,
  TAXONOMY_VERSION,
  WORK_ARRANGEMENT_OPTIONS,
} from "../constants/jobFilterTaxonomy.js";

const NUMBER_WORDS = new Map([
  ["zero", 0],
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
  ["eleven", 11],
  ["twelve", 12],
  ["thirteen", 13],
  ["fourteen", 14],
  ["fifteen", 15],
  ["sixteen", 16],
  ["seventeen", 17],
  ["eighteen", 18],
  ["nineteen", 19],
  ["twenty", 20],
]);

const EXPERIENCE_UI_MIN = 0;
const EXPERIENCE_UI_MAX = 15;

const ENGINEERING_DOMAIN_TO_ROLE_DOMAIN = Object.freeze({
  "Software Engineering": "Software Engineering",
  "Machine Learning": "Data Science & AI",
  "Data Engineering": "Data Engineering",
  "DevOps": "DevOps & SRE",
  "Cloud": "Cloud & Infrastructure",
  "Security": "Cybersecurity",
  "Networking": "Cloud & Infrastructure",
  "Firmware": "Other",
  "Embedded Systems": "Other",
  "RTL": "Other",
  "Verification": "Quality Engineering",
  "Mechanical": "Other",
  "Electrical": "Other",
  "Civil": "Other",
  "Automation": "Other",
  "Robotics": "Other",
  "Research": "Data Science & AI",
});

const ROLE_DOMAIN_RULES = [
  {
    label: "Backend Engineering",
    title: [/\bbackend\b/i, /\bapi\b/i, /\bmicroservices?\b/i],
    text: [/\bbackend\b/i, /\bserver[- ]side\b/i, /\bmicroservices?\b/i, /\bapis?\b/i],
    skills: ["java", "node-js", "postgresql", "kafka"],
  },
  {
    label: "Frontend Engineering",
    title: [/\bfrontend\b/i, /\bfront[- ]end\b/i, /\bui engineer\b/i],
    text: [/\bfrontend\b/i, /\bfront[- ]end\b/i, /\bdesign systems?\b/i],
    skills: ["react", "next-js", "angular", "vue", "javascript", "typescript"],
  },
  {
    label: "Full-Stack Engineering",
    title: [/\bfull[- ]?stack\b/i],
    text: [/\bfull[- ]?stack\b/i],
    skills: ["react", "node-js", "typescript"],
  },
  {
    label: "Mobile Development",
    title: [/\bmobile\b/i, /\bandroid\b/i, /\bios\b/i],
    text: [/\bmobile\b/i, /\bandroid\b/i, /\bios\b/i],
    skills: [],
  },
  {
    label: "Quality Engineering",
    title: [/\bqa\b/i, /\bquality\b/i, /\bsdet\b/i, /\btest automation\b/i],
    text: [/\bquality assurance\b/i, /\btest automation\b/i, /\bsdet\b/i],
    skills: [],
  },
  {
    label: "DevOps & SRE",
    title: [/\bdevops\b/i, /\bsre\b/i, /\bsite reliability\b/i],
    text: [/\bdevops\b/i, /\bsite reliability\b/i, /\bplatform reliability\b/i],
    skills: ["docker", "kubernetes", "terraform", "jenkins", "github-actions"],
  },
  {
    label: "Cloud & Infrastructure",
    title: [/\bcloud\b/i, /\binfrastructure\b/i, /\bplatform\b/i],
    text: [/\bcloud\b/i, /\binfrastructure\b/i, /\bplatform engineering\b/i],
    skills: ["aws", "azure", "gcp", "docker", "kubernetes", "terraform"],
  },
  {
    label: "Data Engineering",
    title: [/\bdata engineer\b/i, /\betl\b/i],
    text: [/\bdata pipelines?\b/i, /\betl\b/i, /\bwarehouse\b/i],
    skills: ["spark", "airflow", "databricks", "snowflake", "kafka", "sql"],
  },
  {
    label: "Data Science & AI",
    title: [/\bdata scientist\b/i, /\bmachine learning\b/i, /\bml engineer\b/i, /\bai engineer\b/i],
    text: [/\bmachine learning\b/i, /\bgenerative ai\b/i, /\bnlp\b/i, /\bcomputer vision\b/i],
    skills: ["machine-learning", "generative-ai", "tensorflow", "pytorch", "mlops"],
  },
  {
    label: "Cybersecurity",
    title: [/\bsecurity\b/i, /\biam\b/i, /\bsoc\b/i],
    text: [/\bsecurity\b/i, /\bthreat\b/i, /\biam\b/i, /\bcompliance\b/i],
    skills: ["cybersecurity"],
  },
  {
    label: "Product & Program Management",
    title: [/\bproduct manager\b/i, /\bprogram manager\b/i, /\bproject manager\b/i],
    text: [/\bproduct roadmap\b/i, /\bprogram management\b/i, /\bproject management\b/i],
    skills: ["salesforce"],
  },
  {
    label: "Design & UX",
    title: [/\bux\b/i, /\bui\b/i, /\bproduct designer\b/i, /\bux researcher\b/i],
    text: [/\buser research\b/i, /\bdesign systems?\b/i, /\bwireframes?\b/i],
    skills: ["figma"],
  },
  {
    label: "Sales & Customer Success",
    title: [/\bsales\b/i, /\bcustomer success\b/i, /\bsupport\b/i, /\baccount executive\b/i],
    text: [/\bcustomer onboarding\b/i, /\bcustomer success\b/i, /\bsales pipeline\b/i, /\bsupport metrics\b/i],
    skills: ["salesforce", "hubspot"],
  },
  {
    label: "Finance & Operations",
    title: [/\bfinance\b/i, /\baccounting\b/i, /\boperations\b/i],
    text: [/\bfinancial analysis\b/i, /\boperations\b/i],
    skills: ["tableau", "power-bi"],
  },
  {
    label: "Legal & Compliance",
    title: [/\blegal\b/i, /\bcompliance\b/i, /\bcounsel\b/i],
    text: [/\blegal\b/i, /\bregulatory\b/i, /\bcompliance\b/i],
    skills: [],
  },
  {
    label: "Human Resources",
    title: [/\bhuman resources\b/i, /\brecruiter\b/i, /\btalent acquisition\b/i, /\bhr\b/i],
    text: [/\bhr\b/i, /\brecruiting\b/i, /\btalent acquisition\b/i],
    skills: [],
  },
  {
    label: "Marketing & Communications",
    title: [/\bmarketing\b/i, /\bcommunications\b/i, /\bcontent\b/i],
    text: [/\bdemand generation\b/i, /\bbrand\b/i, /\bcampaigns?\b/i],
    skills: ["hubspot"],
  },
  {
    label: "Software Engineering",
    title: [/\bsoftware engineer\b/i, /\bdeveloper\b/i, /\bsde\b/i],
    text: [/\bsoftware engineer\b/i, /\bdeveloper\b/i, /\bdistributed systems?\b/i],
    skills: ["java", "python", "node-js", "react", "typescript"],
  },
];

const decodeHtmlEntitiesOnce = (value = "") => String(value)
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const codePoint = Number.parseInt(hex, 16);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
  })
  .replace(/&#(\d+);/g, (_, decimal) => {
    const codePoint = Number.parseInt(decimal, 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
  })
  .replace(/&nbsp;/gi, " ")
  .replace(/&amp;/gi, "&")
  .replace(/&quot;/gi, "\"")
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&lt;/gi, "<")
  .replace(/&gt;/gi, ">");

const decodeHtmlEntities = (value = "") => {
  let decoded = String(value);
  for (let index = 0; index < 3; index += 1) {
    const next = decodeHtmlEntitiesOnce(decoded);
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
};

const stripHtmlToText = (value = "") => String(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
  .replace(/<!--[\s\S]*?-->/g, " ")
  .replace(/<![^>]*>/g, " ")
  .replace(/<\/?[A-Za-z][A-Za-z0-9:-]*\b[^>]*>/g, " ");

const repairSplitExperienceRangeDigits = (value = "") => String(value).replace(
  /(\d{1,2})\s*(?:-|to|~)\s*(\d)\s+(\d)(?=(?:\s+[A-Za-z]|$))/gi,
  (match, minimumValue, maximumTens, maximumOnes, offset, sourceText) => {
    const prefix = sourceText.slice(Math.max(0, offset - 100), offset);
    if (!/\b(?:experience|exp\.?|years?\s+of\s+experience|required qualifications?|qualifications?)\b/i.test(prefix)) {
      return match;
    }

    return `${minimumValue}-${maximumTens}${maximumOnes}`;
  },
);

const normalizeText = (value) =>
  repairSplitExperienceRangeDigits(
    stripHtmlToText(decodeHtmlEntities(value || ""))
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[–—−]/g, "-")
    .replace(/\bm(?:iniumum|inumum)\b/gi, "minimum")
    .replace(/\b(years?|months?|yrs?)['’`]+(?=\s)/gi, "$1 ")
    .replace(/\b(years?|months?|yrs?)\.(?=\s)/gi, "$1 ")
    .replace(/\b(years?|months?|yrs?)['â€™`]*(?=(?:experience|exp\.?)\b)/gi, "$1 ")
    .replace(/(\d+(?:\.\d+)?)(years?|months?|yrs?)(?=(?:experience|exp\.?))/gi, "$1 $2 ")
    .replace(/(\d+(?:\.\d+)?)\s*\?\s*(\d+(?:\.\d+)?)(?=\s*(?:months?|years?|yrs?)\b)/g, "$1-$2")
    .replace(/\b(experience|exp\.?)(?=(?:in|with|of|for)\b)/gi, "$1 ")
    .replace(/\by\s+ear(s)?\b/gi, (match, pluralSuffix) => (pluralSuffix ? "years" : "year"))
    .replace(/\b(years?|months?|yrs?)(?=o\b)/gi, "$1 "),
  )
    .replace(/\s+/g, " ")
    .trim();

const unique = (values = []) => [...new Set(values.filter(Boolean))];
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const NON_NUMERIC_EXPERIENCE_CONTEXT_EXCLUSION_PATTERN = /\b(?:customer|candidate|employee|guest|post-booking|real[- ]world|user)\s+experience\b|\bexperience\s+(?:charter|platform|the\s+world|the\s+perfect\s+blend)\b|\bwork\s+experience\s*\(in\s+years\)\b|\byears?\s+of\s+profitability\b|\bhistory\s+spanning\s+over\b|\bretained\s+for\s+a\s+period\b|\bannual\s+ctc\b|\bupload\s+cv\b/i;
const NON_NUMERIC_EXPERIENCE_REQUIREMENT_CONTEXT_PATTERN = /\b(?:requirements?|role requirements?|qualifications?|required skills?|preferred qualifications?|must-haves?|what you(?:'ll| will)\s+bring|who we are looking for|experience\s*[:\-])\b/i;
const GENERIC_EXPLICIT_EXPERIENCE_LABEL_PATTERN = /^(?:experienced(?: professionals?)?|entry[- ]level|junior level|mid(?:-| )level|senior(?:-| )level|associate(?: level)?)$/i;
const NON_NUMERIC_EXPERIENCE_PATTERNS = [
  {
    pattern: /\b((?:prior|previous|relevant|strong|extensive|demonstrated|demonstrable|proven|hands[- ]on|solid|significant|practical|professional)\s+(?:[a-z-]+\s+){0,2}experience\s+(?:in|with|as|of|managing|mentoring|driving|building|leading|working|designing|troubleshooting|conducting|hiring|aligning|partnering|using|developing|untangling|influencing|executing|running|owning)\b[^.]{0,140})/i,
    requiresRequirementContext: false,
  },
  {
    pattern: /\b((?:prior|previous|relevant|strong|extensive|demonstrated|demonstrable|proven|hands[- ]on|solid|significant|practical|professional)\s+(?:[a-z-]+\s+){0,2}experience\s+(?:preferred|required|desired)\b[^.]{0,120})/i,
    requiresRequirementContext: false,
  },
  {
    pattern: /\b((?:experience|exp\.?)\s+(?:in|with|as|managing|mentoring|driving|building|leading|working|designing|troubleshooting|conducting|hiring|aligning|partnering|using|developing|untangling|influencing|executing|running|owning)\b[^.]{0,140})/i,
    requiresRequirementContext: true,
  },
];
const LATE_SECTIONED_EXPERIENCE_PATTERN = /\b(?:qualifications?|required qualifications?|preferred qualifications?|specific qualifications?|key qualifications?|required skills|must-haves?|what you(?:'ll| will)\s+bring|who we are looking for|direct responsibilities|job position)\b[\s\S]{0,320}?\b(?:at[\s-]*least|min(?:imum)?(?:\s+of)?|more than|over|>=|>|around|about)?\s*\d+(?:\.\d+)?(?:\s*(?:\+|plus|(?:-|to|~)\s*\d+(?:\.\d+)?))?\s*(?:months?|years?|yrs?|yr)\b(?:\s+[^.]{0,120}?\bexperience\b)?/i;
const LATE_MINIMUM_EXPERIENCE_PATTERN = /\b(?:at[\s-]*least|min(?:imum)?(?:\s+of)?|required|preferred)\s*\d+(?:\.\d+)?(?:\s*(?:\+|plus|(?:-|to|~)\s*\d+(?:\.\d+)?))?\s*(?:months?|years?|yrs?|yr)\b[^.]{0,120}?\bexperience\b/i;
const LATE_RANGED_EXPERIENCE_PATTERN = /\b\d+(?:\.\d+)?\s*(?:months?|years?|yrs?|yr)\s*(?:-|to|~)\s*\d+(?:\.\d+)?\s*(?:months?|years?|yrs?|yr)\b[^.]{0,80}?\bexperience\b|\b\d+(?:\.\d+)?\s*(?:-|to|~)\s*\d+(?:\.\d+)?\s*(?:months?|years?|yrs?|yr)\b[^.]{0,80}?\bexperience\b/i;
const LATE_EXACT_EXPERIENCE_PATTERN = /\b(?:experience|required skills|must-haves?|what you(?:'ll| will)\s+bring|who we are looking for|direct responsibilities|job position)\b[\s\S]{0,220}?\b\d+(?:\.\d+)?\s*(?:\+|plus)?\s*(?:months?|years?|yrs?|yr)\b(?:\s+of\s+[^.]{0,120}?\bexperience\b|\s+experience\b)?/i;
const hasLateExplicitExperienceRequirement = (value = "") => (
  (
    (
      /\b(?:years?\s+of\s+experience\s+required|experience\s+required|required experience|required work experience|minimum experience(?:\s+requirement)?)\b/i.test(value)
      && /\b(?:\d+(?:\.\d+)?(?:\s*(?:\+|plus|(?:-|to|~)\s*\d+(?:\.\d+)?))?|no experience|freshers?)\b/i.test(value)
    )
    || (
      /\bexperience\s*[:\-]\b/i.test(value)
      && /\b(?:\d+(?:\.\d+)?(?:\s*(?:\+|plus|(?:-|to|~)\s*\d+(?:\.\d+)?))?\s*(?:months?|years?|yrs?|yr)\b|no experience|freshers?)\b/i.test(value)
    )
  )
  || LATE_SECTIONED_EXPERIENCE_PATTERN.test(value)
  || LATE_MINIMUM_EXPERIENCE_PATTERN.test(value)
  || LATE_RANGED_EXPERIENCE_PATTERN.test(value)
  || LATE_EXACT_EXPERIENCE_PATTERN.test(value)
);

const normalizeNonNumericExperienceEvidence = (value = "") => normalizeText(value)
  ?.replace(/^(?:qualifications?|required skills|good to have|responsibilities?|role requirements?)\s*[:\-]?\s*/i, "")
  .replace(/[;:,.\s]+$/g, "")
  || null;

const extractNonNumericExperienceEvidence = (value = "") => {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  for (const { pattern, requiresRequirementContext } of NON_NUMERIC_EXPERIENCE_PATTERNS) {
    const match = pattern.exec(normalized);
    if (!match) continue;

    const candidate = normalizeNonNumericExperienceEvidence(match[1]);
    if (!candidate || candidate.length < 24) continue;
    if (NON_NUMERIC_EXPERIENCE_CONTEXT_EXCLUSION_PATTERN.test(candidate)) continue;
    if (requiresRequirementContext) {
      const prefix = normalized.slice(Math.max(0, match.index - 120), match.index);
      if (!NON_NUMERIC_EXPERIENCE_REQUIREMENT_CONTEXT_PATTERN.test(prefix)) continue;
    }

    return candidate;
  }

  return null;
};

const stripTrailingCompanyNarrative = (value = "", company = "") => {
  const normalized = normalizeText(value);
  if (!normalized) return normalized;

  const normalizedCompany = normalizeText(company);
  const markers = [
    normalizedCompany ? new RegExp(`\\babout\\s+${escapeRegex(normalizedCompany)}\\b`, "i") : null,
    /\babout\s+[a-z0-9&.' -]{2,60}\b(?=\s+for\s+(?:over|more than)\s+\d+(?:\.\d+)?\s*(?:years?|yrs?)\b)/i,
    /\blearn more about us\b/i,
    /\babout us\b/i,
    /\bwho we are\b/i,
    /\bour social impact\b/i,
  ].filter(Boolean);

  let cutoffIndex = null;
  for (const pattern of markers) {
    const match = pattern.exec(normalized);
    if (!match || match.index < 120) continue;
    const trailingSegment = normalized.slice(match.index);
    if (hasLateExplicitExperienceRequirement(trailingSegment)) continue;
    cutoffIndex = cutoffIndex == null ? match.index : Math.min(cutoffIndex, match.index);
  }

  return cutoffIndex == null
    ? normalized
    : normalized.slice(0, cutoffIndex).trim();
};

const ENTRY_LEVEL_CUE_PATTERN = /\b(?:entry[- ]level|new grad(?:uate)?s?|freshers?|fresh graduates?|recent graduates?|campus (?:hiring|recruitment)|graduate(?:\s+(?:engineer|trainee|associate|developer|programme?|program|hiring|role|scheme|opportunity))|trainee|apprentice)\b/i;

export const hasEntryLevelCue = (value = "") => ENTRY_LEVEL_CUE_PATTERN.test(String(value || ""));
export const extractEntryLevelCue = (value = "") => String(value || "").match(ENTRY_LEVEL_CUE_PATTERN)?.[0] ?? null;

const clampWorkArrangement = (value) =>
  WORK_ARRANGEMENT_OPTIONS.includes(value) ? value : "On-site";

const normalizeNumberWords = (value) => value.replace(
  /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/gi,
  (match) => String(NUMBER_WORDS.get(match.toLowerCase())),
);

const normalizeExperienceNumberForms = (value = "") => normalizeNumberWords(String(value || ""))
  .replace(/\[\s*(\d+(?:\.\d+)?)\s*\](?=\s*(?:months?|years?|yrs?)\b)/gi, "$1")
  .replace(
    /\b(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)\s*\)(?=\s*(?:\+|plus|\b(?:months?|years?|yrs?)\b|(?:-|to)\b))/gi,
    (match, primaryValue, parenthesizedValue) => parenthesizedValue || primaryValue,
  );

const formatExperienceYears = (value, { openEnded = false } = {}) => {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return null;

  const normalizedValue = Number.isInteger(numericValue)
    ? String(numericValue)
    : String(numericValue).replace(/(?:\.0+|(\.\d*?)0+)$/, "$1");
  const unit = numericValue === 1 && !openEnded ? "year" : "years";

  return `${normalizedValue}${openEnded ? "+" : ""} ${unit}`;
};

const formatExperienceValue = (value) => {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return null;

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : String(numericValue).replace(/(?:\.0+|(\.\d*?)0+)$/, "$1");
};

const normalizeExperienceUnit = (value) => {
  const normalized = String(value || "").toLowerCase();
  if (/^yrs?$/.test(normalized) || /^years?$/.test(normalized)) return "years";
  if (/^months?$/.test(normalized)) return "months";
  return normalized;
};

const formatExperienceBoundary = (value, unit) => {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return null;

  const normalizedValue = Number.isInteger(numericValue)
    ? String(numericValue)
    : String(numericValue).replace(/(?:\.0+|(\.\d*?)0+)$/, "$1");
  const normalizedUnit = normalizeExperienceUnit(unit);
  const singularUnit = normalizedUnit === "months" ? "month" : "year";
  const pluralUnit = normalizedUnit === "months" ? "months" : "years";

  return `${normalizedValue} ${numericValue === 1 ? singularUnit : pluralUnit}`;
};

const formatExperienceValueWithUnit = (value, unit, { openEnded = false } = {}) => {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return null;

  const normalizedValue = Number.isInteger(numericValue)
    ? String(numericValue)
    : String(numericValue).replace(/(?:\.0+|(\.\d*?)0+)$/, "$1");
  const normalizedUnit = normalizeExperienceUnit(unit);
  const singularUnit = normalizedUnit === "months" ? "month" : "year";
  const pluralUnit = normalizedUnit === "months" ? "months" : "years";

  return `${normalizedValue}${openEnded ? "+" : ""} ${numericValue === 1 && !openEnded ? singularUnit : pluralUnit}`;
};

const formatContextualExperienceRange = (minimumValue, minimumUnit, maximumValue, maximumUnit) => {
  const startUnit = normalizeExperienceUnit(minimumUnit || maximumUnit);
  const endUnit = normalizeExperienceUnit(maximumUnit || minimumUnit);
  if (!startUnit || !endUnit) return null;

  return startUnit === endUnit
    ? formatExperienceRange(minimumValue, maximumValue, startUnit)
    : formatMixedExperienceRange(minimumValue, startUnit, maximumValue, endUnit);
};

const formatMixedExperienceRange = (minimumValue, minimumUnit, maximumValue, maximumUnit) => {
  const start = formatExperienceBoundary(minimumValue, minimumUnit);
  const end = formatExperienceBoundary(maximumValue, maximumUnit);
  if (!start || !end) return null;
  return `${start} - ${end}`;
};

const formatExperienceRange = (minimumValue, maximumValue, unit = "years") => {
  const start = formatExperienceValue(minimumValue);
  const end = formatExperienceValue(maximumValue);
  if (!start || !end) return null;
  return `${start}-${end} ${normalizeExperienceUnit(unit)}`;
};

const hasNonExperienceDurationContext = (value) => (
  /\b(?:contract(?:\s+to\s+hire)?|internship\s+duration|duration|tenure|term|roadmap|timeline|rotation|semester|semesters|week|weeks)\b/i
    .test(String(value || ""))
);

const hasCompanyProfileExperienceContext = (sourceText = "", matchIndex = 0, matchText = "") => {
  const prefix = String(sourceText || "").slice(Math.max(0, matchIndex - 220), matchIndex);
  return (
    /\b(?:about the team|who we are|about us|our story|locations across|presence and scale|service experiences?|incepted|founded|employees|countries|clients)\b/i
      .test(prefix)
    && !/\b(?:minimum|required|preferred|at[\s-]*least|must have|should have|qualifications?|requirements?)\b/i
      .test(String(matchText || ""))
  );
};

const convertExperienceValueToYears = (value, unit) => {
  const numericValue = Number.parseFloat(value);
  if (!Number.isFinite(numericValue)) return null;

  return normalizeExperienceUnit(unit) === "months"
    ? numericValue / 12
    : numericValue;
};

const bucketFromYears = (minimumYears, maximumYears) => {
  if (minimumYears == null && maximumYears == null) return "unspecified";
  const anchor = minimumYears ?? maximumYears ?? 0;
  if (anchor <= 1) return "0-1";
  if (anchor < 3) return "1-3";
  if (anchor <= 5) return "3-5";
  if (anchor <= 8) return "5-8";
  if (anchor <= 12) return "8-12";
  return "12-plus";
};

const clampExperienceYear = (value) => {
  if (!Number.isFinite(value)) return null;
  return Math.min(EXPERIENCE_UI_MAX, Math.max(EXPERIENCE_UI_MIN, value));
};

const buildExperienceYears = ({ minimumYears, maximumYears, isOpenEnded }) => {
  if (!Number.isFinite(minimumYears) && !Number.isFinite(maximumYears)) {
    return [];
  }

  if (isOpenEnded) {
    const start = clampExperienceYear(Math.ceil(minimumYears));
    if (start == null) return [];

    return Array.from(
      { length: EXPERIENCE_UI_MAX - start + 1 },
      (_, index) => start + index,
    );
  }

  const start = clampExperienceYear(Math.ceil(minimumYears));
  const end = clampExperienceYear(Math.floor(maximumYears));

  if (start == null && end == null) return [];

  if (start != null && end != null && end >= start) {
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }

  const singleYear = clampExperienceYear(
    Math.round(Number.isFinite(minimumYears) ? minimumYears : maximumYears),
  );
  return singleYear == null ? [] : [singleYear];
};

const resolveContextualExperienceUnit = (label, explicitUnit = null) => {
  const normalizedExplicitUnit = normalizeExperienceUnit(explicitUnit);
  if (normalizedExplicitUnit === "months" || normalizedExplicitUnit === "years") {
    return normalizedExplicitUnit;
  }

  return /\bmonth/i.test(String(label || "")) ? "months" : "years";
};

const collectSectionText = (description, labels) => labels
  .flatMap((label) => {
    const pattern = new RegExp(
      `${escapeRegex(label)}:\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z &/+-]{2,}:\\n|$)`,
      "gi",
    );
    return [...String(description || "").matchAll(pattern)].map((match) => match[1].trim());
  })
  .filter(Boolean)
  .join("\n\n");

const findSkillMatches = (text, { source, confidence, required = false, preferred = false } = {}) => {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const matches = [];

  for (const skillEntry of SKILL_REGISTRY) {
    let earliestMatch = null;

    for (const pattern of skillEntry.patterns) {
      const candidate = new RegExp(pattern.source, pattern.flags);
      const result = candidate.exec(normalized);
      if (!result) continue;

      const matchData = {
        index: result.index,
        matchedPhrase: result[0],
      };

      if (!earliestMatch || matchData.index < earliestMatch.index) {
        earliestMatch = matchData;
      }
    }

    if (!earliestMatch) continue;

    matches.push({
      skillId: skillEntry.id,
      canonicalName: skillEntry.label,
      category: skillEntry.category,
      required,
      preferred,
      confidence,
      extractionSource: source,
      matchedPhrase: earliestMatch.matchedPhrase,
      index: earliestMatch.index,
    });
  }

  return matches.sort((left, right) => (
    left.index - right.index || left.canonicalName.localeCompare(right.canonicalName)
  ));
};

const mergeSkillMatches = (...groups) => {
  const merged = new Map();

  for (const group of groups.flat()) {
    if (!merged.has(group.skillId)) {
      merged.set(group.skillId, {
        skillId: group.skillId,
        canonicalName: group.canonicalName,
        category: group.category,
        required: Boolean(group.required),
        preferred: Boolean(group.preferred),
        confidence: group.confidence,
        extractionSource: group.extractionSource,
        matchedPhrase: group.matchedPhrase,
      });
      continue;
    }

    const existing = merged.get(group.skillId);
    existing.required = existing.required || Boolean(group.required);
    existing.preferred = existing.preferred || Boolean(group.preferred);
    if (existing.confidence !== "high" && group.confidence === "high") {
      existing.confidence = "high";
    }
    if (!existing.matchedPhrase) {
      existing.matchedPhrase = group.matchedPhrase;
    }
    if (existing.extractionSource !== "structured" && group.extractionSource === "structured") {
      existing.extractionSource = "structured";
    }
  }

  return [...merged.values()];
};

const collectStructuredSkillMatches = (values, options) => {
  const matches = [];
  for (const value of Array.isArray(values) ? values : []) {
    matches.push(...findSkillMatches(value, options));
  }
  return matches;
};

const parseExperienceProfile = (job = {}) => {
  const titleText = normalizeText(job.title);
  const explicitExperienceField = normalizeExperienceNumberForms(
    normalizeText(job.experienceRequired),
  );
  const explicitText = unique(
    [job.experienceRequired, job.minimumQualification, job.preferredQualification]
      .map((value) => normalizeText(value))
      .filter(Boolean),
  ).join(" ");
  const normalizedExplicitText = normalizeExperienceNumberForms(explicitText);
  const descriptiveText = unique(
    [job.description, job.jobDescription]
      .map((value) => stripTrailingCompanyNarrative(value, job.company))
      .filter(Boolean),
  ).join(" ");
  const titleAndExplicitText = normalizeExperienceNumberForms(
    [titleText, explicitText]
      .filter(Boolean)
      .join(" "),
  );
  const canonicalExplicitRequirement = /^\d+(?:\.\d+)?(?:\s*(?:\+|plus|(?:-|to)\s*\d+(?:\.\d+)?))?\s*(?:months?|years?|yrs?)$/i.test(explicitExperienceField || '');
  const combinedText = normalizeExperienceNumberForms(
    (canonicalExplicitRequirement ? [explicitExperienceField] : [titleText, explicitText, descriptiveText])
      .filter(Boolean)
      .join(" "),
  );

  const baseProfile = {
    rawText: explicitText || descriptiveText || titleText || null,
    minimumYears: null,
    maximumYears: null,
    isOpenEnded: false,
    preferredMinimumYears: null,
    hasExplicitExperience: false,
    confidence: "low",
    evidence: null,
  };

  // A selected month-based closed interval must be ordered before it can
  // supply numeric filters. Preserve the authored raw text when it is not.
  const hasReversedMonthBounds = (minimumYears, maximumYears, ...units) => (
    maximumYears < minimumYears
    && units.some((unit) => normalizeExperienceUnit(unit) === "months")
  );

  if (!combinedText) {
    return {
      ...baseProfile,
      experienceBucket: "unspecified",
    };
  }

  const requirementText = normalizeExperienceNumberForms([
    job.minimumQualification && `Required qualifications: ${normalizeText(job.minimumQualification)}`,
    descriptiveText,
    job.preferredQualification && `Preferred qualifications: ${normalizeText(job.preferredQualification)}`,
  ].filter(Boolean).join(' '));
  const alternativeRequirement = alternativeExperienceRequirement(explicitExperienceField || requirementText);
  if (alternativeRequirement) {
    return { ...baseProfile, hasExplicitExperience: true, confidence: 'high', evidence: alternativeRequirement, experienceBucket: 'unspecified' };
  }

  if (!explicitExperienceField) {
    const primaryRequirement = mainExperienceRequirement(requirementText);
    if (primaryRequirement) {
      return {
        ...parseExperienceProfile({ experienceRequired: primaryRequirement }),
        rawText: baseProfile.rawText,
      };
    }
  }

  // An upper value followed by '+' is still a range with its own lower
  // bound. Reading only the trailing '2+ years' drops zero-year eligibility.
  // Keep the authored range as evidence without inventing an upper cap.
  const upperOpenRangeText = explicitExperienceField || combinedText;
  const upperOpenRangeMatch = upperOpenRangeText.match(
    /\b(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*\+\s*(months?|years?|yrs?)\b/i,
  );
  if (upperOpenRangeMatch) {
    const prefix = upperOpenRangeText.slice(Math.max(0, upperOpenRangeMatch.index - 120), upperOpenRangeMatch.index).split(/[.;\n]/).at(-1);
    const suffix = upperOpenRangeText.slice(upperOpenRangeMatch.index + upperOpenRangeMatch[0].length);
    const context = `${prefix}${upperOpenRangeMatch[0]}`;
    const experienceContext = Boolean(explicitExperienceField)
      || /\b(?:experience|exp\.?)\s*[:\-]\s*[^.;\n]{0,100}$|\bexperience\s*$/i.test(prefix)
      || /^\s+(?:of\s+)?(?:[a-z-]+\s+){0,6}(?:experience|exp\.?)\b/i.test(suffix);
    const companyHistory = /\b(?:(?:our|the|this)\s+(?:company|business|organization|organisation)|we)\s+(?:has|have|with|brings?)\b/i.test(prefix);
    const unrelatedDuration = !explicitExperienceField && /\b(?:ages?|aged|after|within)\s*\(?\s*$/i.test(prefix);
    if (experienceContext && !companyHistory && !unrelatedDuration && !hasNonExperienceDurationContext(context)
      && !hasCompanyProfileExperienceContext(upperOpenRangeText, upperOpenRangeMatch.index, context)) {
      const minimumYears = convertExperienceValueToYears(upperOpenRangeMatch[1], upperOpenRangeMatch[3]);
      const upperValue = convertExperienceValueToYears(upperOpenRangeMatch[2], upperOpenRangeMatch[3]);
      if (upperValue < minimumYears) return { ...baseProfile, experienceBucket: 'unspecified' };
      return {
        ...baseProfile, minimumYears, maximumYears: null, isOpenEnded: true,
        hasExplicitExperience: true, confidence: 'high',
        evidence: `${upperOpenRangeMatch[1]}-${upperOpenRangeMatch[2]}+ ${normalizeExperienceUnit(upperOpenRangeMatch[3])}`,
        experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
      };
    }
  }

  const explicitFieldRangeMatch = explicitExperienceField?.match(
    /^(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)(?:\s*(months?))?$/i,
  );
  if (explicitFieldRangeMatch) {
    const unit = explicitFieldRangeMatch[3] || "years";
    const minimumYears = convertExperienceValueToYears(explicitFieldRangeMatch[1], unit);
    const maximumYears = convertExperienceValueToYears(explicitFieldRangeMatch[2], unit);
    if (explicitFieldRangeMatch[3] && maximumYears < minimumYears) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceRange(
        explicitFieldRangeMatch[1],
        explicitFieldRangeMatch[2],
        unit,
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const explicitFieldPlusMatch = explicitExperienceField?.match(
    /^(\d+(?:\.\d+)?)\s*(?:\+|plus)$/,
  );
  if (explicitFieldPlusMatch) {
    const minimumYears = Number.parseFloat(explicitFieldPlusMatch[1]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        explicitFieldPlusMatch[1],
        "years",
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const explicitFieldExactMatch = explicitExperienceField?.match(
    /^(\d+(?:\.\d+)?)$/,
  );
  if (explicitFieldExactMatch) {
    const exactYears = Number.parseFloat(explicitFieldExactMatch[1]);
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(explicitFieldExactMatch[1], "years"),
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const explicitFieldContextualValueMatch = explicitExperienceField?.match(
    /^(\d+(?:\.\d+)?)\s*(\+|plus)?\s*(months?|years?|yrs?)\s+(?:of|for)\s+.+?\bexperience\b$/i,
  );
  if (explicitFieldContextualValueMatch) {
    const exactYears = convertExperienceValueToYears(
      explicitFieldContextualValueMatch[1],
      explicitFieldContextualValueMatch[3],
    );
    const openEnded = Boolean(explicitFieldContextualValueMatch[2]);
    const evidence = formatExperienceValueWithUnit(
      explicitFieldContextualValueMatch[1],
      explicitFieldContextualValueMatch[3],
      { openEnded },
    );

    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: openEnded ? null : exactYears,
      isOpenEnded: openEnded,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: openEnded
        ? bucketFromYears(Math.floor(exactYears), null)
        : bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const noExperienceMatch = combinedText.match(
    /\b(no prior experience required|no experience required|freshers? can apply|entry-level applicants are encouraged)\b/i,
  );
  if (noExperienceMatch) {
    return {
      ...baseProfile,
      minimumYears: 0,
      maximumYears: 0,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: noExperienceMatch[0],
      experienceBucket: "0-1",
    };
  }

  const fresherCueMatch = combinedText.match(
    /\b(freshers?|fresh graduates?|recent graduates?)\b/i,
  );
  if (
    fresherCueMatch
    && !/\b\d+(?:\.\d+)?\s*(?:-|to|\+)?\s*\d*(?:\.\d+)?\s*(?:years?|yrs?|months?)\b/i.test(combinedText)
  ) {
    return {
      ...baseProfile,
      minimumYears: 0,
      maximumYears: 0,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: fresherCueMatch[0],
      experienceBucket: "0-1",
    };
  }

  const genericExplicitExperienceLabel = explicitExperienceField?.match(
    GENERIC_EXPLICIT_EXPERIENCE_LABEL_PATTERN,
  )?.[0];
  if (genericExplicitExperienceLabel) {
    return {
      ...baseProfile,
      hasExplicitExperience: true,
      confidence: "medium",
      evidence: genericExplicitExperienceLabel,
      experienceBucket: "unspecified",
    };
  }

  const labeledRangeMatch = combinedText.match(
    /\b((?:(?:required|minimum|preferred|total)\s+)?(?:years?|months?)\s+of\s+experience|(?:required|minimum|preferred|total)\s+experience|experience\s+required)\b\s*[:\-]?\s*(?:min(?:imum)?(?:\s+of)?|at[\s-]*least)?\s*(\d+(?:\.\d+)?)\s*(?:-|~|to)\s*(\d+(?:\.\d+)?)(?:\s*(months?|years?|yrs?))?\b/i,
  );
  if (labeledRangeMatch) {
    const unit = resolveContextualExperienceUnit(labeledRangeMatch[1], labeledRangeMatch[4]);
    const minimumYears = convertExperienceValueToYears(labeledRangeMatch[2], unit);
    const maximumYears = convertExperienceValueToYears(labeledRangeMatch[3], unit);
    const evidence = formatExperienceRange(labeledRangeMatch[2], labeledRangeMatch[3], unit);

    if (hasReversedMonthBounds(minimumYears, maximumYears, unit)) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const labeledValueMatch = combinedText.match(
    /\b((?:(?:required|minimum|preferred|total)\s+)?(?:years?|months?)\s+of\s+experience|(?:required|minimum|preferred|total)\s+experience|experience\s+required)\b\s*[:\-]?\s*(?:min(?:imum)?(?:\s+of)?|at[\s-]*least)?\s*(\d+(?:\.\d+)?)(?:\s*(\+|plus))?(?:\s*(months?|years?|yrs?))?\b/i,
  );
  if (labeledValueMatch) {
    const unit = resolveContextualExperienceUnit(labeledValueMatch[1], labeledValueMatch[4]);
    const exactValue = convertExperienceValueToYears(labeledValueMatch[2], unit);
    const openEnded = Boolean(labeledValueMatch[3]);
    const evidence = formatExperienceValueWithUnit(labeledValueMatch[2], unit, { openEnded });

    return {
      ...baseProfile,
      minimumYears: exactValue,
      maximumYears: openEnded ? null : exactValue,
      isOpenEnded: openEnded,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: openEnded
        ? bucketFromYears(Math.floor(exactValue), null)
        : bucketFromYears(Math.floor(exactValue), Math.ceil(exactValue)),
    };
  }

  const workExperienceMinimumExpMatch = combinedText.match(
    /\bwork\s+experience\b[^.]{0,80}?\bmin\.?\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+of\s+[^.]{0,40}?\b(?:experience|exp\.?)\b/i,
  );
  if (workExperienceMinimumExpMatch) {
    const exactValue = convertExperienceValueToYears(
      workExperienceMinimumExpMatch[1],
      workExperienceMinimumExpMatch[2],
    );
    const evidence = formatExperienceValueWithUnit(
      workExperienceMinimumExpMatch[1],
      workExperienceMinimumExpMatch[2],
    );

    return {
      ...baseProfile,
      minimumYears: exactValue,
      maximumYears: exactValue,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(exactValue), Math.ceil(exactValue)),
    };
  }

  const bareExperienceLabelValueMatch = combinedText.match(
    /\b(?:experience|exp\.?)\s*[:\-]\s*(\d+(?:\.\d+)?)(?:\s*(\+|plus))?\b/i,
  );
  // A complete year interval in this same label is not an exact lower value.
  // Reuse the canonical range reader without changing other field precedence.
  const bareExperienceYearRangeTail = bareExperienceLabelValueMatch && !bareExperienceLabelValueMatch[2]
    ? combinedText.slice(bareExperienceLabelValueMatch.index + bareExperienceLabelValueMatch[0].length)
      .match(/^\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(years?|yrs?)\b/i)
    : null;
  if (bareExperienceYearRangeTail
    && Number.isFinite(Number(bareExperienceLabelValueMatch[1]))
    && Number.isFinite(Number(bareExperienceYearRangeTail[1]))
    && Number(bareExperienceYearRangeTail[1]) >= Number(bareExperienceLabelValueMatch[1])) {
    return {
      ...parseExperienceProfile({ experienceRequired: `${bareExperienceLabelValueMatch[1]} - ${bareExperienceYearRangeTail[1]} ${bareExperienceYearRangeTail[2]}` }),
      rawText: baseProfile.rawText,
    };
  }

  // Leave a complete months range for the unit-aware range parser below;
  // this untyped single-value rule must not consume only its lower bound.
  if (bareExperienceLabelValueMatch && !/^\s*(?:-|to)\s*\d+(?:\.\d+)?\s*months?\b/i.test(
    combinedText.slice(bareExperienceLabelValueMatch.index + bareExperienceLabelValueMatch[0].length),
  )) {
    const exactValue = convertExperienceValueToYears(bareExperienceLabelValueMatch[1], "years");
    const openEnded = Boolean(bareExperienceLabelValueMatch[2]);
    const evidence = formatExperienceValueWithUnit(
      bareExperienceLabelValueMatch[1],
      "years",
      { openEnded },
    );

    return {
      ...baseProfile,
      minimumYears: exactValue,
      maximumYears: openEnded ? null : exactValue,
      isOpenEnded: openEnded,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: openEnded
        ? bucketFromYears(Math.floor(exactValue), null)
        : bucketFromYears(Math.floor(exactValue), Math.ceil(exactValue)),
    };
  }

  const labeledMinMaxRangeMatch = combinedText.match(
    /\b(?:min(?:imum)?|minimum|required)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)?\b[^.]{0,40}?\b(?:max(?:imum|x)?|up\s+to)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (labeledMinMaxRangeMatch) {
    const startUnit = labeledMinMaxRangeMatch[2] || labeledMinMaxRangeMatch[4];
    const endUnit = labeledMinMaxRangeMatch[4] || labeledMinMaxRangeMatch[2];
    const minimumYears = convertExperienceValueToYears(labeledMinMaxRangeMatch[1], startUnit);
    const maximumYears = convertExperienceValueToYears(labeledMinMaxRangeMatch[3], endUnit);
    const evidence = formatContextualExperienceRange(
      labeledMinMaxRangeMatch[1],
      startUnit,
      labeledMinMaxRangeMatch[3],
      endUnit,
    );

    if (hasReversedMonthBounds(minimumYears, maximumYears, startUnit, endUnit)) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(minimumYears, maximumYears),
    };
  }

  const parenthesizedMinimumRangeMatch = combinedText.match(
    /\bexperience\b[^.]{0,180}?\(\s*min\.?\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\.?\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\.?\s*\)/i,
  );
  if (
    parenthesizedMinimumRangeMatch
    && !hasNonExperienceDurationContext(parenthesizedMinimumRangeMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      parenthesizedMinimumRangeMatch[1],
      parenthesizedMinimumRangeMatch[2],
    );
    const maximumYears = convertExperienceValueToYears(
      parenthesizedMinimumRangeMatch[3],
      parenthesizedMinimumRangeMatch[4],
    );
    const evidence = formatContextualExperienceRange(
      parenthesizedMinimumRangeMatch[1],
      parenthesizedMinimumRangeMatch[2],
      parenthesizedMinimumRangeMatch[3],
      parenthesizedMinimumRangeMatch[4],
    );

    if (hasReversedMonthBounds(minimumYears, maximumYears, parenthesizedMinimumRangeMatch[2], parenthesizedMinimumRangeMatch[4])) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(minimumYears, maximumYears),
    };
  }

  const mixedUnitRangeMatch = combinedText.match(
    /(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b[^.]{0,80}?\bexperience\b/i,
  );
  if (mixedUnitRangeMatch) {
    const startUnit = normalizeExperienceUnit(mixedUnitRangeMatch[2]);
    const endUnit = normalizeExperienceUnit(mixedUnitRangeMatch[4]);

    if (startUnit !== endUnit) {
      const minimumYears = convertExperienceValueToYears(mixedUnitRangeMatch[1], startUnit);
      const maximumYears = convertExperienceValueToYears(mixedUnitRangeMatch[3], endUnit);
      const evidence = formatMixedExperienceRange(
        mixedUnitRangeMatch[1],
        startUnit,
        mixedUnitRangeMatch[3],
        endUnit,
      );

      if (hasReversedMonthBounds(minimumYears, maximumYears, startUnit, endUnit)) {
        return { ...baseProfile, experienceBucket: "unspecified" };
      }
      return {
        ...baseProfile,
        minimumYears,
        maximumYears,
        hasExplicitExperience: true,
        confidence: "high",
        evidence,
        experienceBucket: bucketFromYears(minimumYears, maximumYears),
      };
    }
  }

  const betweenExperienceRangeMatch = combinedText.match(
    /\b(?:total\s+work\s+)?experience\s+between\s*(\d+(?:\.\d+)?)\s*(?:and|to|-)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (betweenExperienceRangeMatch) {
    const minimumYears = convertExperienceValueToYears(
      betweenExperienceRangeMatch[1],
      betweenExperienceRangeMatch[3],
    );
    const maximumYears = convertExperienceValueToYears(
      betweenExperienceRangeMatch[2],
      betweenExperienceRangeMatch[3],
    );
    const evidence = formatExperienceRange(
      betweenExperienceRangeMatch[1],
      betweenExperienceRangeMatch[2],
      betweenExperienceRangeMatch[3],
    );

    if (hasReversedMonthBounds(minimumYears, maximumYears, betweenExperienceRangeMatch[3])) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const contextualRepeatedUnitRangeMatch = (
    combinedText.match(
      /\(?\s*(?:(?:over|around)\s+)?(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)?\s*(?:-|~|to)\s*(\d+(?:\.\d+)?)(?:\s*[-–—]?\s*)(months?|years?|yrs?)\)?[^.]{0,120}?\b(?:general|managerial|relevant|overall|professional|specific|related|hands[- ]on|working|comprehensive)?\s*experience\b/i,
    )
    || combinedText.match(
      /\b(?:general|managerial|relevant|overall|professional|specific|related|hands[- ]on|working|comprehensive)?\s*experience\b[^.]{0,120}?\(?\s*(?:(?:over|around)\s+)?(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)?\s*(?:-|~|to)\s*(\d+(?:\.\d+)?)(?:\s*[-–—]?\s*)(months?|years?|yrs?)\)?/i,
    )
  );
  if (
    contextualRepeatedUnitRangeMatch
    && !hasNonExperienceDurationContext(contextualRepeatedUnitRangeMatch[0])
  ) {
    const startUnit = contextualRepeatedUnitRangeMatch[2] || contextualRepeatedUnitRangeMatch[4];
    const endUnit = contextualRepeatedUnitRangeMatch[4] || contextualRepeatedUnitRangeMatch[2];
    const minimumYears = convertExperienceValueToYears(contextualRepeatedUnitRangeMatch[1], startUnit);
    const maximumYears = convertExperienceValueToYears(contextualRepeatedUnitRangeMatch[3], endUnit);
    const evidence = formatContextualExperienceRange(
      contextualRepeatedUnitRangeMatch[1],
      startUnit,
      contextualRepeatedUnitRangeMatch[3],
      endUnit,
    );

    if (hasReversedMonthBounds(minimumYears, maximumYears, startUnit, endUnit)) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(minimumYears, maximumYears),
    };
  }

  const experienceRequirementValueMatch = combinedText.match(
    /\b(?:minimum\s+)?experience\s+requirement\b\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (experienceRequirementValueMatch) {
    const exactYears = convertExperienceValueToYears(
      experienceRequirementValueMatch[1],
      experienceRequirementValueMatch[2],
    );
    const evidence = formatExperienceValueWithUnit(
      experienceRequirementValueMatch[1],
      experienceRequirementValueMatch[2],
    );

    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const experienceWordTrailingUnitRangeMatch = combinedText.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s+experience\s+(months?|years?|yrs?)\b/i,
  );
  if (experienceWordTrailingUnitRangeMatch) {
    const minimumYears = convertExperienceValueToYears(
      experienceWordTrailingUnitRangeMatch[1],
      experienceWordTrailingUnitRangeMatch[3],
    );
    const maximumYears = convertExperienceValueToYears(
      experienceWordTrailingUnitRangeMatch[2],
      experienceWordTrailingUnitRangeMatch[3],
    );
    const evidence = formatExperienceRange(
      experienceWordTrailingUnitRangeMatch[1],
      experienceWordTrailingUnitRangeMatch[2],
      experienceWordTrailingUnitRangeMatch[3],
    );

    if (hasReversedMonthBounds(minimumYears, maximumYears, experienceWordTrailingUnitRangeMatch[3])) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const minimumWordMidRangeMatch = combinedText.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s+minimum\s+(months?|years?|yrs?)\s+of\s+experience\b/i,
  );
  if (minimumWordMidRangeMatch) {
    const minimumYears = convertExperienceValueToYears(
      minimumWordMidRangeMatch[1],
      minimumWordMidRangeMatch[3],
    );
    const maximumYears = convertExperienceValueToYears(
      minimumWordMidRangeMatch[2],
      minimumWordMidRangeMatch[3],
    );
    const evidence = formatExperienceRange(
      minimumWordMidRangeMatch[1],
      minimumWordMidRangeMatch[2],
      minimumWordMidRangeMatch[3],
    );

    if (hasReversedMonthBounds(minimumYears, maximumYears, minimumWordMidRangeMatch[3])) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const candidateCuedApproximateSingleValueMatch = combinedText.match(
    /\b(?:have|has|with|possess(?:es)?|bring(?:s)?|need(?:ed)?|required|should have|must have)\b[^.]{0,120}?\(?\s*(?:around|about)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\)?\s+experience\b/i,
  );
  if (candidateCuedApproximateSingleValueMatch) {
    const exactYears = convertExperienceValueToYears(
      candidateCuedApproximateSingleValueMatch[1],
      candidateCuedApproximateSingleValueMatch[2],
    );
    const evidence = formatExperienceValueWithUnit(
      candidateCuedApproximateSingleValueMatch[1],
      candidateCuedApproximateSingleValueMatch[2],
    );

    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const minimumRequirementsContributionMatch = combinedText.match(
    /\bminimum requirements?\b[\s\S]{0,180}?\b(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+of\s+(?:recent\s+)?(?:involvement|contribution)\b/i,
  );
  if (minimumRequirementsContributionMatch) {
    const minimumYears = convertExperienceValueToYears(
      minimumRequirementsContributionMatch[1],
      minimumRequirementsContributionMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        minimumRequirementsContributionMatch[1],
        minimumRequirementsContributionMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const labeledOpenEndedMatch = combinedText.match(
    /\b(?:years?\s+of\s+experience|(?:relevant\s+)?experience|exp\.?)\s*[:;\-]{0,2}\s*(?:>|>=|more than|over)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (labeledOpenEndedMatch) {
    const minimumYears = convertExperienceValueToYears(labeledOpenEndedMatch[1], labeledOpenEndedMatch[2]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(labeledOpenEndedMatch[1], labeledOpenEndedMatch[2], { openEnded: true }),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const keySkillsUpToMatch = combinedText.match(
    /\bkey skills?\b[^.]{0,80}?\b(?:up\s*to|upto)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (keySkillsUpToMatch) {
    const maximumYears = convertExperienceValueToYears(
      keySkillsUpToMatch[1],
      keySkillsUpToMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears: 0,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceRange("0", keySkillsUpToMatch[1], keySkillsUpToMatch[2]),
      experienceBucket: bucketFromYears(0, maximumYears),
    };
  }

  const contextualUpToMatch = combinedText.match(
    /\b(?:up\s*to|upto)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+(?:of\s+)?(?:overall\s+|relevant\s+|professional\s+|hands[- ]on\s+|working\s+|managerial\s+|specific\s+|comprehensive\s+|related\s+|prior\s+|previous\s+|post[- ]qualification\s+)?(?:experience|exp\.?)\b/i,
  );
  if (
    contextualUpToMatch
    && !hasNonExperienceDurationContext(contextualUpToMatch[0])
  ) {
    const maximumYears = convertExperienceValueToYears(
      contextualUpToMatch[1],
      contextualUpToMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears: 0,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceRange("0", contextualUpToMatch[1], contextualUpToMatch[2]),
      experienceBucket: bucketFromYears(0, maximumYears),
    };
  }

  const minimumAtLeastExperienceMatch = combinedText.match(
    /\b(?:minimum(?:\s+of)?|at[\s-]*least)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b(?:\s+of\s+[^.]{0,80}?\bexperience|\s+(?:progressive\s+)?experience)\b/i,
  );
  if (
    minimumAtLeastExperienceMatch
    && !hasNonExperienceDurationContext(minimumAtLeastExperienceMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      minimumAtLeastExperienceMatch[1],
      minimumAtLeastExperienceMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        minimumAtLeastExperienceMatch[1],
        minimumAtLeastExperienceMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const minimumDomainExperienceMatch = combinedText.match(
    /\b(?:min\.?|minimum|at[\s-]*least)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b\s+in\s+[^.]{0,120}?\b(?:environment|role|roles?|field|domain|industry|sales|development|engineering|operations|support|product|marketing|design|testing|platform|technology|programming|banking|finance|accounting|consulting|sap)\b/i,
  );
  if (
    minimumDomainExperienceMatch
    && !hasNonExperienceDurationContext(minimumDomainExperienceMatch[0])
    && !/\b(?:must have|should have|you have|you should have|ideal candidate)\b/i.test(
      combinedText.slice(Math.max(0, minimumDomainExperienceMatch.index - 48), minimumDomainExperienceMatch.index),
    )
  ) {
    const exactYears = convertExperienceValueToYears(
      minimumDomainExperienceMatch[1],
      minimumDomainExperienceMatch[2],
    );
    const evidence = formatExperienceValueWithUnit(
      minimumDomainExperienceMatch[1],
      minimumDomainExperienceMatch[2],
    );

    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const candidateCuedOpenEndedMatch = combinedText.match(
    /\b(?:essential|must have|should have|you have|you should have|you are fit if|candidate(?:s)?(?:\s+(?:should|must))?\s+have|possess|need(?:ed)?|required|preferred|ideal candidate(?:\s+should\s+have)?)\b[^.]{0,120}?\b(?:over|more than)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b[^.]{0,80}?\b(?:experience|exp\.?)\b/i,
  );
  if (candidateCuedOpenEndedMatch) {
    const minimumYears = convertExperienceValueToYears(
      candidateCuedOpenEndedMatch[1],
      candidateCuedOpenEndedMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedOpenEndedMatch[1],
        candidateCuedOpenEndedMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const candidateCuedTrailingSubjectOpenEndedMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|basic requirements|minimum requirements|required qualifications?|required skills|must have|should have|what we.re looking for|what you.ll bring|you.ll need|all about you|help you succeed(?:\s+and\s+grow)?)\b[\s\S]{0,220}?\b(?:commercial|professional|relevant|overall|industry|hands[- ]on)?\s*experience\b(?:\s+in\s+[^.;:()]{0,100})?\s*\((?:more than|over)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\)/i,
  );
  if (candidateCuedTrailingSubjectOpenEndedMatch) {
    const minimumYears = convertExperienceValueToYears(
      candidateCuedTrailingSubjectOpenEndedMatch[1],
      candidateCuedTrailingSubjectOpenEndedMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedTrailingSubjectOpenEndedMatch[1],
        candidateCuedTrailingSubjectOpenEndedMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const candidateCuedPlusPrefixedYearsMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|required qualification|what you will need|what you.ll bring|all about you)\b[\s\S]{0,180}?(?:(?:over|more than)\s*)?\+\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+(?:of\s+)?[^.]{0,100}?\b(?:architecting|selling|designing|developing|managing|supporting|building|leading|operating)\b/i,
  );
  if (candidateCuedPlusPrefixedYearsMatch) {
    const minimumYears = convertExperienceValueToYears(
      candidateCuedPlusPrefixedYearsMatch[1],
      candidateCuedPlusPrefixedYearsMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedPlusPrefixedYearsMatch[1],
        candidateCuedPlusPrefixedYearsMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const candidateCuedTrailingPlusYearsMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|minimum qualifications?|required qualification|what you will need|what you.ll bring|all about you|who you are)\b[\s\S]{0,360}?\b(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s*\+/i,
  );
  if (candidateCuedTrailingPlusYearsMatch) {
    const minimumYears = convertExperienceValueToYears(
      candidateCuedTrailingPlusYearsMatch[1],
      candidateCuedTrailingPlusYearsMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedTrailingPlusYearsMatch[1],
        candidateCuedTrailingPlusYearsMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const candidateCuedMinimumYearsInDomainMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|minimum qualifications?|required qualification|what you will need|what you.ll bring|all about you|who you are|must have|should have|required|preferred)\b[\s\S]{0,240}?\bm(?:inimum|miniumum|minumum)(?:\s+of)?\s+(\d+(?:\.\d+)?)\s*(months?|years?|yrs?|yr)\s*(\+)?\s+in\s+[^.]{0,140}?\b[a-z][a-z0-9/+#&._-]*\b/i,
  );
  if (
    candidateCuedMinimumYearsInDomainMatch
    && !hasNonExperienceDurationContext(candidateCuedMinimumYearsInDomainMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      candidateCuedMinimumYearsInDomainMatch[1],
      candidateCuedMinimumYearsInDomainMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedMinimumYearsInDomainMatch[1],
        candidateCuedMinimumYearsInDomainMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const candidateCuedExactYearsInDomainMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|minimum qualifications?|required qualification|what you will need|what you.ll bring|all about you|who you are|must have|should have|required|preferred)\b[\s\S]{0,240}?\b(\d+(?:\.\d+)?)(?:\s*(?:-|to)\s*(\d+(?:\.\d+)?))?\s*(months?|years?|yrs?|yr)\s*(\+)?\s+in\s+[^.]{0,140}?\b[a-z][a-z0-9/+#&._-]*\b/i,
  );
  if (
    candidateCuedExactYearsInDomainMatch
    && !hasNonExperienceDurationContext(candidateCuedExactYearsInDomainMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      candidateCuedExactYearsInDomainMatch[1],
      candidateCuedExactYearsInDomainMatch[3],
    );
    const openEnded = Boolean(candidateCuedExactYearsInDomainMatch[4]);
    const maximumYears = candidateCuedExactYearsInDomainMatch[2]
      ? convertExperienceValueToYears(candidateCuedExactYearsInDomainMatch[2], candidateCuedExactYearsInDomainMatch[3])
      : minimumYears;
    if (maximumYears < minimumYears) return { ...baseProfile, experienceBucket: 'unspecified' };
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: openEnded ? null : maximumYears,
      isOpenEnded: openEnded,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: candidateCuedExactYearsInDomainMatch[2] && !openEnded ? formatExperienceRange(
        candidateCuedExactYearsInDomainMatch[1], candidateCuedExactYearsInDomainMatch[2], candidateCuedExactYearsInDomainMatch[3],
      ) : formatExperienceValueWithUnit(
        candidateCuedExactYearsInDomainMatch[1],
        candidateCuedExactYearsInDomainMatch[3],
        { openEnded },
      ),
      experienceBucket: openEnded
        ? bucketFromYears(Math.floor(minimumYears), null)
        : bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const candidateCuedExactYearsWorkVerbMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|required qualification|what you will need|what you.ll bring|all about you|what we.re looking for|who you are|ideal candidate(?:\s+will\s+possess\s+following|\s+should\s+have)?)\b[\s\S]{0,220}?\b(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+(?:in\s+)?[^.]{0,120}?\b(?:supporting|managing|architecting|selling|designing|developing|building|leading|operating|working)\b/i,
  );
  if (
    candidateCuedExactYearsWorkVerbMatch
    && !hasNonExperienceDurationContext(candidateCuedExactYearsWorkVerbMatch[0])
  ) {
    const exactYears = convertExperienceValueToYears(
      candidateCuedExactYearsWorkVerbMatch[1],
      candidateCuedExactYearsWorkVerbMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedExactYearsWorkVerbMatch[1],
        candidateCuedExactYearsWorkVerbMatch[2],
      ),
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const candidateCuedExperiencedYearsMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|minimum qualifications?|required qualification|what we.re looking for|we.re looking for people who have|all about you|who you are)\b[\s\S]{0,220}?\b(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+experienced\b/i,
  );
  if (
    candidateCuedExperiencedYearsMatch
    && !hasNonExperienceDurationContext(candidateCuedExperiencedYearsMatch[0])
    && !/\b\d+(?:\.\d+)?\s*(?:or|\/|-|to)\s*\d+(?:\.\d+)?\s*(?:months?|years?|yrs?)\s+experienced\b/i
      .test(candidateCuedExperiencedYearsMatch[0])
  ) {
    const exactYears = convertExperienceValueToYears(
      candidateCuedExperiencedYearsMatch[1],
      candidateCuedExperiencedYearsMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedExperiencedYearsMatch[1],
        candidateCuedExperiencedYearsMatch[2],
      ),
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const candidateCuedYearsInRoleCategoryMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|minimum qualifications?|required qualification|what you will need|what you.ll bring|all about you|what we.re looking for|who you are)\b[\s\S]{0,240}?\b(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+in\s+(?!the\s+(?:same|current|present)\s+role\b)[^.]{0,140}?\broles?\b/i,
  );
  if (
    candidateCuedYearsInRoleCategoryMatch
    && !hasNonExperienceDurationContext(candidateCuedYearsInRoleCategoryMatch[0])
  ) {
    const exactYears = convertExperienceValueToYears(
      candidateCuedYearsInRoleCategoryMatch[1],
      candidateCuedYearsInRoleCategoryMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedYearsInRoleCategoryMatch[1],
        candidateCuedYearsInRoleCategoryMatch[2],
      ),
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const candidateCuedRoleHistoryForYearsMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|minimum qualifications?|required qualification|what you will need|what you.ll bring|all about you)\b[\s\S]{0,220}?\b(?:played|worked|served|functioned)\b[^.]{0,120}?\bfor\s+(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (
    candidateCuedRoleHistoryForYearsMatch
    && !hasNonExperienceDurationContext(candidateCuedRoleHistoryForYearsMatch[0])
  ) {
    const exactYears = convertExperienceValueToYears(
      candidateCuedRoleHistoryForYearsMatch[1],
      candidateCuedRoleHistoryForYearsMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedRoleHistoryForYearsMatch[1],
        candidateCuedRoleHistoryForYearsMatch[2],
      ),
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const requiredQualificationsSectionMatch = combinedText.match(
    /\brequired qualifications?, capabilities, and skills\b([\s\S]{0,900}?)(?=\bpreferred qualifications?, capabilities, and skills\b|$)/i,
  );
  const requiredQualificationsSingleValueMatch = requiredQualificationsSectionMatch?.[1]?.match(
    /\b(?:(more than|over|>=|>)\s*)?[~â‰ˆ]?\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+(?:of|for)\s+[^.]{0,120}?\bexperience\b/i,
  );
  if (
    requiredQualificationsSingleValueMatch
    && !hasNonExperienceDurationContext(requiredQualificationsSingleValueMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      requiredQualificationsSingleValueMatch[2],
      requiredQualificationsSingleValueMatch[3],
    );
    const openEnded = Boolean(requiredQualificationsSingleValueMatch[1]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: openEnded ? null : minimumYears,
      isOpenEnded: openEnded,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        requiredQualificationsSingleValueMatch[2],
        requiredQualificationsSingleValueMatch[3],
        { openEnded },
      ),
      experienceBucket: openEnded
        ? bucketFromYears(Math.floor(minimumYears), null)
        : bucketFromYears(Math.floor(minimumYears), Math.ceil(minimumYears)),
    };
  }

  const candidateCuedYearsWithBackgroundMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|basic requirements|minimum requirements|required qualifications?|required skills|must have|should have|what we.re looking for|what you.ll bring|you.ll need|all about you|help you succeed(?:\s+and\s+grow)?)\b[\s\S]{0,260}?\b(?:(more than|over|>=|>)\s*)?(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+with\b[^.]{0,120}?\b(?:background|expertise|knowledge|understanding|exposure|focus)\b/i,
  );
  if (
    candidateCuedYearsWithBackgroundMatch
    && !hasNonExperienceDurationContext(candidateCuedYearsWithBackgroundMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      candidateCuedYearsWithBackgroundMatch[2],
      candidateCuedYearsWithBackgroundMatch[3],
    );
    const openEnded = Boolean(candidateCuedYearsWithBackgroundMatch[1]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: openEnded ? null : minimumYears,
      isOpenEnded: openEnded,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedYearsWithBackgroundMatch[2],
        candidateCuedYearsWithBackgroundMatch[3],
        { openEnded },
      ),
      experienceBucket: openEnded
        ? bucketFromYears(Math.floor(minimumYears), null)
        : bucketFromYears(Math.floor(minimumYears), Math.ceil(minimumYears)),
    };
  }

  const candidateCuedSingleValueMatch = combinedText.match(
    /\b(?:requirements?(?!\s+of\b)|qualifications?|basic requirements|minimum requirements|required qualifications?|required skills|must have|should have|what we.re looking for|what you.ll bring|you.ll need|experience(?:, education and other required)?|all about you|help you succeed(?:\s+and\s+grow)?)\b[\s\S]{0,220}?\b(?:(more than|over|>=|>)\s*)?[~≈]?\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+(?:of|for)\s+[^.]{0,80}?\bexperience\b/i,
  );
  if (
    candidateCuedSingleValueMatch
    && !hasNonExperienceDurationContext(candidateCuedSingleValueMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      candidateCuedSingleValueMatch[2],
      candidateCuedSingleValueMatch[3],
    );
    const openEnded = Boolean(candidateCuedSingleValueMatch[1]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: openEnded ? null : minimumYears,
      isOpenEnded: openEnded,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        candidateCuedSingleValueMatch[2],
        candidateCuedSingleValueMatch[3],
        { openEnded },
      ),
      experienceBucket: openEnded
        ? bucketFromYears(Math.floor(minimumYears), null)
        : bucketFromYears(Math.floor(minimumYears), Math.ceil(minimumYears)),
    };
  }

  const academicQualificationExperienceYearsMatch = combinedText.match(
    /\bacademic qualification(?:\s*&\s*experience)?\b[\s\S]{0,80}?\+\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (
    academicQualificationExperienceYearsMatch
    && !hasNonExperienceDurationContext(academicQualificationExperienceYearsMatch[0])
  ) {
    const exactYears = convertExperienceValueToYears(
      academicQualificationExperienceYearsMatch[1],
      academicQualificationExperienceYearsMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        academicQualificationExperienceYearsMatch[1],
        academicQualificationExperienceYearsMatch[2],
      ),
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const qualificationLineOpenEndedMatch = combinedText.match(
    /\b(?:b\.?e\.?|be\/mtech|btech|mtech|graduation|masters?|bachelor(?:'s)?|graduate)\b[\s\S]{0,100}?\b(?:more than|over|>=|>)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (
    qualificationLineOpenEndedMatch
    && !hasNonExperienceDurationContext(qualificationLineOpenEndedMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      qualificationLineOpenEndedMatch[1],
      qualificationLineOpenEndedMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        qualificationLineOpenEndedMatch[1],
        qualificationLineOpenEndedMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const qualificationLineRangeMatch = combinedText.match(
    /\b(?:b\.?e\.?|be\/mtech|btech|mtech|graduation|masters?|bachelor(?:'s)?|graduate)\b[\s\S]{0,100}?\b(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (
    qualificationLineRangeMatch
    && !hasNonExperienceDurationContext(qualificationLineRangeMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      qualificationLineRangeMatch[1],
      qualificationLineRangeMatch[2],
    );
    const maximumYears = convertExperienceValueToYears(
      qualificationLineRangeMatch[3],
      qualificationLineRangeMatch[4],
    );
    if (hasReversedMonthBounds(minimumYears, maximumYears, qualificationLineRangeMatch[2], qualificationLineRangeMatch[4])) {
      return { ...baseProfile, experienceBucket: "unspecified" };
    }
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatContextualExperienceRange(
        qualificationLineRangeMatch[1],
        qualificationLineRangeMatch[2],
        qualificationLineRangeMatch[3],
        qualificationLineRangeMatch[4],
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const qualificationLineSingleValueMatch = combinedText.match(
    /\b(?:b\.?e\.?|be\/mtech|btech|mtech|graduation|masters?|bachelor(?:'s)?|graduate)\b[\s\S]{0,100}?\b(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b(?!\s*(?:-|to)\s*\d)(?!\s*(?:\+|\bplus\b))(?:\s+(or\s+more|or\s+above|and\s+above))?/i,
  );
  if (
    qualificationLineSingleValueMatch
    && !hasNonExperienceDurationContext(qualificationLineSingleValueMatch[0])
    && !/\b(?:at[- ]least|minimum|more than|over|>=|>)\b/i.test(qualificationLineSingleValueMatch[0])
  ) {
    const exactYears = convertExperienceValueToYears(
      qualificationLineSingleValueMatch[1],
      qualificationLineSingleValueMatch[2],
    );
    const openEnded = Boolean(qualificationLineSingleValueMatch[3]);
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: openEnded ? null : exactYears,
      isOpenEnded: openEnded,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        qualificationLineSingleValueMatch[1],
        qualificationLineSingleValueMatch[2],
        { openEnded },
      ),
      experienceBucket: openEnded
        ? bucketFromYears(Math.floor(exactYears), null)
        : bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const contextualOrMoreMatch = (
    combinedText.match(
      /\b(?:experience|exp\.?)\b[^.]{0,80}?\bfor\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+or\s+more\b/i,
    )
    || combinedText.match(
      /\b(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+or\s+more\b[^.]{0,80}?\b(?:experience|exp\.?)\b/i,
    )
  );
  if (
    contextualOrMoreMatch
    && !hasNonExperienceDurationContext(contextualOrMoreMatch[0])
  ) {
    const minimumYears = convertExperienceValueToYears(
      contextualOrMoreMatch[1],
      contextualOrMoreMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(
        contextualOrMoreMatch[1],
        contextualOrMoreMatch[2],
        { openEnded: true },
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const experiencedRangeMatch = combinedText.match(
    /(\d+(?:\.\d+)?)\s*(?:or|\/)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\s+experienced\b/i,
  );
  if (experiencedRangeMatch) {
    const minimumYears = Number.parseFloat(experiencedRangeMatch[1]);
    const maximumYears = Number.parseFloat(experiencedRangeMatch[2]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceRange(experiencedRangeMatch[1], experiencedRangeMatch[2], "years"),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const hyphenatedUnitRangeMatch = combinedText.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*[-–—]\s*(years?|yrs?)\b/i,
  );
  if (hyphenatedUnitRangeMatch) {
    const minimumYears = Number.parseFloat(hyphenatedUnitRangeMatch[1]);
    const maximumYears = Number.parseFloat(hyphenatedUnitRangeMatch[2]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceRange(
        hyphenatedUnitRangeMatch[1],
        hyphenatedUnitRangeMatch[2],
        hyphenatedUnitRangeMatch[3],
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const compactHyphenatedToRangeMatch = combinedText.match(
    /(\d+(?:\.\d+)?)\s*-\s*to\s*-\s*(\d+(?:\.\d+)?)\s*[-â€“â€”]\s*(years?|yrs?)\b/i,
  );
  if (compactHyphenatedToRangeMatch) {
    const minimumYears = Number.parseFloat(compactHyphenatedToRangeMatch[1]);
    const maximumYears = Number.parseFloat(compactHyphenatedToRangeMatch[2]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceRange(
        compactHyphenatedToRangeMatch[1],
        compactHyphenatedToRangeMatch[2],
        compactHyphenatedToRangeMatch[3],
      ),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const rangeMatch = combinedText.match(
    /(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:years?|yrs?)\b/i,
  );
  if (rangeMatch) {
    const minimumYears = Number.parseFloat(rangeMatch[1]);
    const maximumYears = Number.parseFloat(rangeMatch[2]);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: rangeMatch[0],
      experienceBucket: bucketFromYears(Math.floor(minimumYears), Math.ceil(maximumYears)),
    };
  }

  const plusMatchPattern = [
    {
      match: combinedText.match(
        /(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s*(?:\+\s*plus|plus)\b(?:\s+of)?(?:\s+[^.]{0,80}?)?\bexperience\b/i,
      ),
      valueIndex: 1,
      unitIndex: 2,
    },
    {
      match: combinedText.match(
        /(\d+(?:\.\d+)?)\s*(?:\+|plus)\s*(months?|years?|yrs?)\b/i,
      ),
      valueIndex: 1,
      unitIndex: 2,
    },
    {
      match: combinedText.match(
        /(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s*(?:and above|or above)\b/i,
      ),
      valueIndex: 1,
      unitIndex: 2,
    },
    {
      match: combinedText.match(
        /(\d+(?:\.\d+)?)\s+or\s+more\s+(months?|years?|yrs?)\b(?:\s+of\s+experience)?/i,
      ),
      valueIndex: 1,
      unitIndex: 2,
    },
    {
      match: combinedText.match(
        /(\d+(?:\.\d+)?)\+\s+(?:overall\s+|relevant\s+|professional\s+|hands[- ]on\s+|working\s+|managerial\s+|specific\s+|comprehensive\s+|related\s+)?(?:experience|exp\.?)\b/i,
      ),
      valueIndex: 1,
      unitIndex: null,
    },
    {
      match: combinedText.match(
        /(?:at[\s-]*least|min(?:imum)?(?:\s+of)?|required|preferred)\s*[:\-]?\s*(?:full[- ]time\s+)?(\d+(?:\.\d+)?)\s*[- ]?\s*(months?|years?|yrs?)\b(?:\s+(?:of\s+[^.]{0,80}?\bexperience|experience))?/i,
      ),
      valueIndex: 1,
      unitIndex: 2,
    },
  ].find(({ match }) => match);
  if (plusMatchPattern) {
    const { match, valueIndex, unitIndex } = plusMatchPattern;
    const normalizedUnit = unitIndex == null ? "years" : match[unitIndex];
    const minimumYears = convertExperienceValueToYears(match[valueIndex], normalizedUnit);
    return {
      ...baseProfile,
      minimumYears,
      maximumYears: null,
      isOpenEnded: true,
      hasExplicitExperience: true,
      confidence: "high",
      evidence: formatExperienceValueWithUnit(match[valueIndex], normalizedUnit, { openEnded: true }),
      experienceBucket: bucketFromYears(Math.floor(minimumYears), null),
    };
  }

  const comparableExperienceMatch = combinedText.match(
    /\bexperience\s*\(?\s*comparable\s+to\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s*\)?/i,
  );
  if (comparableExperienceMatch) {
    const exactYears = convertExperienceValueToYears(
      comparableExperienceMatch[1],
      comparableExperienceMatch[2],
    );
    const evidence = formatExperienceValueWithUnit(
      comparableExperienceMatch[1],
      comparableExperienceMatch[2],
    );
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const contextualSingleValueMatch = (
    combinedText.match(
      /(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\s+(?:of\s+)?(?:overall\s+|relevant\s+|professional\s+|hands[- ]on\s+|working\s+|managerial\s+|specific\s+|comprehensive\s+|related\s+|prior\s+|previous\s+|post[- ]qualification\s+)?(?:experience|exp\.?)\b/i,
    )
    || combinedText.match(
      /\b(?:experience|exp\.?)\s*(?::|of|required:?|-)?\s*(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
    )
  );
  if (
    contextualSingleValueMatch
    && !hasCompanyProfileExperienceContext(
      combinedText,
      contextualSingleValueMatch.index,
      contextualSingleValueMatch[0],
    )
  ) {
    const exactYears = convertExperienceValueToYears(contextualSingleValueMatch[1], contextualSingleValueMatch[2]);
    const evidence = formatExperienceValueWithUnit(contextualSingleValueMatch[1], contextualSingleValueMatch[2]);
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: "high",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const explicitSingleValueMatch = normalizedExplicitText.match(
    /(\d+(?:\.\d+)?)\s*(months?|years?|yrs?)\b/i,
  );
  if (explicitSingleValueMatch) {
    const exactYears = convertExperienceValueToYears(explicitSingleValueMatch[1], explicitSingleValueMatch[2]);
    const evidence = formatExperienceValueWithUnit(explicitSingleValueMatch[1], explicitSingleValueMatch[2]);
    return {
      ...baseProfile,
      minimumYears: exactYears,
      maximumYears: exactYears,
      hasExplicitExperience: true,
      confidence: canonicalExplicitRequirement ? "high" : "medium",
      evidence,
      experienceBucket: bucketFromYears(Math.floor(exactYears), Math.ceil(exactYears)),
    };
  }

  const entryLevelCue = extractEntryLevelCue(`${titleText} ${combinedText}`);
  if (entryLevelCue) {
    return {
      ...baseProfile,
      minimumYears: 0,
      maximumYears: 0,
      hasExplicitExperience: hasEntryLevelCue(combinedText),
      confidence: explicitText ? "medium" : "low",
      evidence: entryLevelCue,
      experienceBucket: "0-1",
    };
  }

  const nonNumericExperienceEvidence = extractNonNumericExperienceEvidence(combinedText);
  if (nonNumericExperienceEvidence) {
    return {
      ...baseProfile,
      hasExplicitExperience: true,
      confidence: "medium",
      evidence: nonNumericExperienceEvidence,
      experienceBucket: "unspecified",
    };
  }

  return {
    ...baseProfile,
    experienceBucket: "unspecified",
  };
};

const classifySeniority = (job = {}, experienceProfile = {}) => {
  const titleText = normalizeText(job.title).toLowerCase();
  const explicitExperienceLevel = normalizeText(job.experienceLevel);
  const combinedText = normalizeText([job.title, job.description, job.jobDescription].join(" ")).toLowerCase();

  if (/\bintern(ship)?\b/.test(titleText)) return { value: "Internship", confidence: "high" };
  if (/\bapprentice\b/.test(titleText)) return { value: "Apprentice", confidence: "high" };
  if (hasEntryLevelCue(combinedText)) {
    return { value: "Entry Level", confidence: "high" };
  }
  if (/\bvice president\b|\bvp\b/.test(titleText)) return { value: "Vice President", confidence: "high" };
  if (/\bchief\b|\bexecutive\b/.test(titleText)) return { value: "Executive", confidence: "high" };
  if (/\bdirector\b/.test(titleText)) return { value: "Director", confidence: "high" };
  if (/\bsenior manager\b/.test(titleText)) return { value: "Senior Manager", confidence: "high" };
  if (/\bmanager\b/.test(titleText)) return { value: "Manager", confidence: "high" };
  if (/\bprincipal\b/.test(titleText)) return { value: "Principal", confidence: "high" };
  if (/\bstaff\b/.test(titleText)) return { value: "Staff", confidence: "high" };
  if (/\blead\b/.test(titleText)) return { value: "Lead", confidence: "high" };
  if (/\bsenior\b|\bsr\.?\b/.test(titleText)) return { value: "Senior", confidence: "high" };

  if (explicitExperienceLevel === "Entry Level") return { value: "Entry Level", confidence: "medium" };
  if (explicitExperienceLevel === "Junior Level") return { value: "Associate", confidence: "medium" };
  if (explicitExperienceLevel === "Mid Level") return { value: "Mid Level", confidence: "medium" };
  if (explicitExperienceLevel === "Senior Level") return { value: "Senior", confidence: "medium" };

  if (experienceProfile.minimumYears != null) {
    if (experienceProfile.minimumYears <= 1) return { value: "Entry Level", confidence: "medium" };
    if (experienceProfile.minimumYears <= 3) return { value: "Associate", confidence: "medium" };
    if (experienceProfile.minimumYears <= 5) return { value: "Mid Level", confidence: "medium" };
    return { value: "Senior", confidence: "medium" };
  }

  return { value: "Unknown", confidence: "low" };
};

const scoreRulePatterns = (text, patterns = [], weight) => patterns.reduce(
  (total, pattern) => total + (pattern.test(text) ? weight : 0),
  0,
);

const classifyRoleDomain = (job = {}, skillIds = []) => {
  const titleText = normalizeText(job.title);
  const departmentText = normalizeText(job.department);
  const descriptionText = normalizeText([job.description, job.jobDescription].join(" "));
  const skillSet = new Set(skillIds);
  const mappedEngineeringDomain = ENGINEERING_DOMAIN_TO_ROLE_DOMAIN[normalizeText(job.engineeringDomain)] || null;
  const scores = new Map();

  for (const domainLabel of ROLE_DOMAIN_OPTIONS) {
    scores.set(domainLabel, 0);
  }

  for (const rule of ROLE_DOMAIN_RULES) {
    let score = 0;
    score += scoreRulePatterns(titleText, rule.title, 5);
    score += scoreRulePatterns(departmentText, rule.title, 4);
    score += scoreRulePatterns(descriptionText, rule.text, 2);
    score += rule.skills.reduce((total, skillId) => total + (skillSet.has(skillId) ? 3 : 0), 0);

    scores.set(rule.label, (scores.get(rule.label) || 0) + score);
  }

  if (mappedEngineeringDomain) {
    scores.set(mappedEngineeringDomain, (scores.get(mappedEngineeringDomain) || 0) + 3);
  }

  const sorted = [...scores.entries()]
    .filter(([, score]) => score > 0)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));

  if (sorted.length === 0) {
    return {
      primaryRoleDomain: "Other",
      secondaryRoleDomains: [],
      confidence: "low",
    };
  }

  let [primaryRoleDomain, primaryScore] = sorted[0];

  if (primaryRoleDomain === "Software Engineering") {
    const moreSpecificDomain = sorted.find(([label, score]) => (
      label !== "Software Engineering"
      && label !== "Other"
      && score >= primaryScore - 2
    ));

    if (moreSpecificDomain) {
      [primaryRoleDomain, primaryScore] = moreSpecificDomain;
    }
  }

  const secondaryRoleDomains = sorted
    .slice(1)
    .filter(([label, score]) => (
      label !== primaryRoleDomain
      && score >= primaryScore - 2
      && score >= 3
    ))
    .map(([label]) => label)
    .slice(0, 3);

  return {
    primaryRoleDomain,
    secondaryRoleDomains,
    confidence: primaryScore >= 8 ? "high" : "medium",
  };
};

const detectWorkArrangement = (job = {}) => {
  const explicit = normalizeText(job.workArrangement || job.remoteStatus);
  if (explicit) {
    if (/hybrid/i.test(explicit)) return "Hybrid";
    if (/remote/i.test(explicit)) return "Remote";
    if (/on[- ]site/i.test(explicit)) return "On-site";
  }

  const locationText = normalizeText(
    [job.location, ...(Array.isArray(job.locations) ? job.locations : [])]
      .filter(Boolean)
      .join(" "),
  );
  const descriptionText = normalizeText([job.description, job.jobDescription].join(" "));
  const combined = `${locationText} ${descriptionText}`.toLowerCase();

  if (/\bhybrid\b/.test(combined)) return "Hybrid";
  if (/\bremote\b/.test(locationText.toLowerCase()) || /\bremote\b/.test(combined)) return "Remote";
  if (/\bon[- ]site\b|\bonsite\b|\bin[- ]office\b/.test(combined)) return "On-site";
  if (locationText) return "On-site";
  return "Not specified";
};

export const extractJobFilterSignals = (job = {}) => {
  job = withSourceDescription(job);
  const normalizedDescription = normalizeText(job.jobDescription || job.description);
  const requiredSectionText = collectSectionText(normalizedDescription, [
    "MINIMUM QUALIFICATIONS",
    "QUALIFICATIONS",
    "TECHNICAL COMPETENCIES & EXPERIENCE",
    "TECHNICAL COMPETENCIES",
    "SOFTWARE SKILLS",
    "IT SKILLS",
    "LANGUAGE & SKILLS",
  ]);
  const preferredSectionText = collectSectionText(normalizedDescription, ["PREFERRED QUALIFICATIONS"]);

  const requiredMatches = mergeSkillMatches(
    collectStructuredSkillMatches(job.requiredSkills, {
      source: "structured",
      confidence: "high",
      required: true,
    }),
    findSkillMatches(job.minimumQualification, {
      source: "minimumQualification",
      confidence: "high",
      required: true,
    }),
    findSkillMatches(requiredSectionText, {
      source: "description-required-section",
      confidence: "medium",
      required: true,
    }),
  );

  const preferredMatches = mergeSkillMatches(
    findSkillMatches(job.preferredQualification, {
      source: "preferredQualification",
      confidence: "high",
      preferred: true,
    }),
    findSkillMatches(preferredSectionText, {
      source: "description-preferred-section",
      confidence: "medium",
      preferred: true,
    }),
  );

  const generalMatches = mergeSkillMatches(
    findSkillMatches(job.title, {
      source: "title",
      confidence: "medium",
    }),
    findSkillMatches(job.department, {
      source: "department",
      confidence: "medium",
    }),
    findSkillMatches(normalizedDescription, {
      source: "description",
      confidence: "medium",
    }),
  );

  const jobSkills = mergeSkillMatches(requiredMatches, preferredMatches, generalMatches);
  const requiredSkillIds = requiredMatches.map((match) => match.skillId);
  const preferredSkillIds = preferredMatches
    .map((match) => match.skillId)
    .filter((skillId) => !requiredSkillIds.includes(skillId));
  const skillIds = jobSkills.map((match) => match.skillId);
  const experienceProfile = parseExperienceProfile(job);
  const experienceYears = buildExperienceYears(experienceProfile);
  const seniority = classifySeniority(job, experienceProfile);
  const roleDomain = classifyRoleDomain(job, skillIds);
  const workArrangement = detectWorkArrangement(job);

  return {
    skillIds,
    requiredSkillIds,
    preferredSkillIds,
    jobSkills,
    experienceBucket: EXPERIENCE_BUCKET_VALUES.includes(experienceProfile.experienceBucket)
      ? experienceProfile.experienceBucket
      : "unspecified",
    experienceProfile,
    experienceYears,
    seniority: SENIORITY_LEVELS.includes(seniority.value) ? seniority.value : "Unknown",
    primaryRoleDomain: ROLE_DOMAIN_OPTIONS.includes(roleDomain.primaryRoleDomain)
      ? roleDomain.primaryRoleDomain
      : "Other",
    secondaryRoleDomains: unique(
      roleDomain.secondaryRoleDomains.filter((value) => ROLE_DOMAIN_OPTIONS.includes(value)),
    ),
    workArrangement: clampWorkArrangement(workArrangement),
    filterSignals: {
      confidence: {
        experience: experienceProfile.confidence,
        seniority: seniority.confidence,
        roleDomain: roleDomain.confidence,
        workArrangement: workArrangement === "Not specified" ? "low" : "high",
      },
    },
    taxonomyVersion: TAXONOMY_VERSION,
    extractionVersion: EXTRACTION_VERSION,
    extractedAt: new Date(),
    ...(job.classification?.authoritative === true && ['enforce', 'policy'].includes(job.classification.mode)
      && job.classification.policyVersion === JOB_CLASSIFICATION_POLICY_VERSION
      && ['accepted', 'uncertain', 'fallback'].includes(job.classification.status)
      && ['Intern', 'Full-time Fresher', 'Full-time Experienced', 'Contract', 'Others', 'Unspecified'].includes(job.classification.resolved?.jobType)
      ? {
        experienceProfile: job.classification.resolved.experienceProfile,
        experienceYears: job.classification.resolved.experienceYears,
        experienceBucket: job.classification.resolved.experienceBucket,
        seniority: job.classification.resolved.seniority,
      } : {}),
  };
};
