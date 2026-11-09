const skill = ({ id, label, category, aliases = [], patterns = [] }) => ({
  id,
  label,
  category,
  aliases: [...new Set(aliases.map((value) => String(value).trim()).filter(Boolean))],
  patterns,
});

export const TAXONOMY_VERSION = "2026-07-16-v1";
export const EXTRACTION_VERSION = "2026-07-16-v1";

export const EXPERIENCE_BUCKET_OPTIONS = Object.freeze([
  { value: "unspecified", label: "No experience specified" },
  { value: "0-1", label: "0-1 years" },
  { value: "1-3", label: "1-3 years" },
  { value: "3-5", label: "3-5 years" },
  { value: "5-8", label: "5-8 years" },
  { value: "8-12", label: "8-12 years" },
  { value: "12-plus", label: "12+ years" },
]);

export const EXPERIENCE_BUCKET_VALUES = Object.freeze(
  EXPERIENCE_BUCKET_OPTIONS.map(({ value }) => value),
);

export const ROLE_DOMAIN_OPTIONS = Object.freeze([
  "Software Engineering",
  "Frontend Engineering",
  "Backend Engineering",
  "Full-Stack Engineering",
  "Mobile Development",
  "Quality Engineering",
  "DevOps & SRE",
  "Cloud & Infrastructure",
  "Data Engineering",
  "Data Science & AI",
  "Cybersecurity",
  "Product & Program Management",
  "Design & UX",
  "Sales & Customer Success",
  "Finance & Operations",
  "Legal & Compliance",
  "Human Resources",
  "Marketing & Communications",
  "Other",
]);

export const SENIORITY_LEVELS = Object.freeze([
  "Internship",
  "Apprentice",
  "Entry Level",
  "Associate",
  "Mid Level",
  "Senior",
  "Staff",
  "Principal",
  "Lead",
  "Manager",
  "Senior Manager",
  "Director",
  "Vice President",
  "Executive",
  "Unknown",
]);

export const WORK_ARRANGEMENT_OPTIONS = Object.freeze([
  "Remote",
  "Hybrid",
  "On-site",
]);

export const DATE_POSTED_NA_VALUE = "na";
export const DATE_POSTED_OLDER_THAN_30_VALUE = "older-than-30";

export const DATE_POSTED_WINDOW_OPTIONS = Object.freeze(
  Array.from({ length: 31 }, (_, index) => index),
);

export const DATE_POSTED_OPTIONS = Object.freeze([
  ...DATE_POSTED_WINDOW_OPTIONS,
  DATE_POSTED_OLDER_THAN_30_VALUE,
  DATE_POSTED_NA_VALUE,
]);

export const SKILL_MATCH_MODE_OPTIONS = Object.freeze([
  { value: "any", label: "Match any selected skill" },
  { value: "all", label: "Match all selected skills" },
]);

export const SKILL_SCOPE_OPTIONS = Object.freeze([
  { value: "all", label: "Required or preferred skills" },
  { value: "required", label: "Required skills only" },
]);

export const SKILL_REGISTRY = Object.freeze([
  skill({
    id: "java",
    label: "Java",
    category: "Programming Languages",
    aliases: ["java"],
    patterns: [/\bjava\b/i],
  }),
  skill({
    id: "python",
    label: "Python",
    category: "Programming Languages",
    aliases: ["python", "py"],
    patterns: [/\bpython\b/i],
  }),
  skill({
    id: "javascript",
    label: "JavaScript",
    category: "Programming Languages",
    aliases: ["javascript", "react js", "js"],
    patterns: [/\bjavascript\b/i, /\bjava script\b/i],
  }),
  skill({
    id: "typescript",
    label: "TypeScript",
    category: "Programming Languages",
    aliases: ["typescript", "ts"],
    patterns: [/\btypescript\b/i, /\btype script\b/i],
  }),
  skill({
    id: "go",
    label: "Go",
    category: "Programming Languages",
    aliases: ["go", "golang"],
    patterns: [
      /\bgolang\b/i,
      /\bgo\b(?=\s+(?:developer|engineer|lang|language|microservices?|backend|services?|api|apis|programming)\b)/i,
      /\b(?:developer|engineer|programming|language)\s+in\s+go\b/i,
    ],
  }),
  skill({
    id: "sql",
    label: "SQL",
    category: "Programming Languages",
    aliases: ["sql"],
    patterns: [/\bsql\b/i],
  }),
  skill({
    id: "node-js",
    label: "Node.js",
    category: "Frameworks & Libraries",
    aliases: ["node.js", "nodejs"],
    patterns: [/\bnode\.?js\b/i, /\bnodejs\b/i],
  }),
  skill({
    id: "react",
    label: "React",
    category: "Frameworks & Libraries",
    aliases: ["react", "react.js"],
    patterns: [
      /\breact\.js\b/i,
      /\breact\b(?=[^.\n]{0,25}\b(?:javascript|typescript|frontend|components?|hooks|native)\b)/i,
      /\b(?:javascript|typescript|frontend|components?|hooks|native)\b[^.\n]{0,25}\breact\b/i,
    ],
  }),
  skill({
    id: "next-js",
    label: "Next.js",
    category: "Frameworks & Libraries",
    aliases: ["next.js", "nextjs"],
    patterns: [/\bnext\.?js\b/i, /\bnextjs\b/i],
  }),
  skill({
    id: "express",
    label: "Express",
    category: "Frameworks & Libraries",
    aliases: ["express", "express.js"],
    patterns: [/\bexpress(?:\.js)?\b/i],
  }),
  skill({
    id: "spring-boot",
    label: "Spring Boot",
    category: "Frameworks & Libraries",
    aliases: ["spring boot", "springboot"],
    patterns: [/\bspring\s*boot\b/i, /\bspringboot\b/i],
  }),
  skill({
    id: "django",
    label: "Django",
    category: "Frameworks & Libraries",
    aliases: ["django"],
    patterns: [/\bdjango\b/i],
  }),
  skill({
    id: "flask",
    label: "Flask",
    category: "Frameworks & Libraries",
    aliases: ["flask"],
    patterns: [/\bflask\b/i],
  }),
  skill({
    id: "fastapi",
    label: "FastAPI",
    category: "Frameworks & Libraries",
    aliases: ["fastapi"],
    patterns: [/\bfastapi\b/i],
  }),
  skill({
    id: "angular",
    label: "Angular",
    category: "Frameworks & Libraries",
    aliases: ["angular"],
    patterns: [/\bangular\b/i],
  }),
  skill({
    id: "vue",
    label: "Vue",
    category: "Frameworks & Libraries",
    aliases: ["vue", "vue.js"],
    patterns: [/\bvue(?:\.js)?\b/i],
  }),
  skill({
    id: "aws",
    label: "AWS",
    category: "Cloud Platforms",
    aliases: ["aws", "amazon web services"],
    patterns: [/\baws\b/i, /\bamazon web services\b/i],
  }),
  skill({
    id: "azure",
    label: "Azure",
    category: "Cloud Platforms",
    aliases: ["azure", "microsoft azure"],
    patterns: [/\bazure\b/i, /\bmicrosoft azure\b/i],
  }),
  skill({
    id: "gcp",
    label: "Google Cloud Platform",
    category: "Cloud Platforms",
    aliases: ["gcp", "google cloud", "google cloud platform"],
    patterns: [/\bgcp\b/i, /\bgoogle cloud(?: platform)?\b/i],
  }),
  skill({
    id: "postgresql",
    label: "PostgreSQL",
    category: "Databases & Data Systems",
    aliases: ["postgres", "postgresql"],
    patterns: [/\bpostgres(?:ql)?\b/i, /\bpostgre sql\b/i],
  }),
  skill({
    id: "mysql",
    label: "MySQL",
    category: "Databases & Data Systems",
    aliases: ["mysql"],
    patterns: [/\bmysql\b/i],
  }),
  skill({
    id: "mongodb",
    label: "MongoDB",
    category: "Databases & Data Systems",
    aliases: ["mongodb", "mongo db", "mongo"],
    patterns: [/\bmongo\s*db\b/i, /\bmongodb\b/i],
  }),
  skill({
    id: "redis",
    label: "Redis",
    category: "Databases & Data Systems",
    aliases: ["redis"],
    patterns: [/\bredis\b/i],
  }),
  skill({
    id: "kafka",
    label: "Kafka",
    category: "Databases & Data Systems",
    aliases: ["kafka", "apache kafka"],
    patterns: [/\bkafka\b/i, /\bapache kafka\b/i],
  }),
  skill({
    id: "databricks",
    label: "Databricks",
    category: "Databases & Data Systems",
    aliases: ["databricks"],
    patterns: [/\bdatabricks\b/i],
  }),
  skill({
    id: "snowflake",
    label: "Snowflake",
    category: "Databases & Data Systems",
    aliases: ["snowflake"],
    patterns: [/\bsnowflake\b/i],
  }),
  skill({
    id: "spark",
    label: "Spark",
    category: "Databases & Data Systems",
    aliases: ["spark", "apache spark"],
    patterns: [/\bapache spark\b/i, /\bspark\b(?=\s+(?:streaming|sql|cluster|jobs?|pipelines?)\b)/i],
  }),
  skill({
    id: "airflow",
    label: "Airflow",
    category: "Databases & Data Systems",
    aliases: ["airflow", "apache airflow"],
    patterns: [/\bairflow\b/i, /\bapache airflow\b/i],
  }),
  skill({
    id: "docker",
    label: "Docker",
    category: "DevOps & Infrastructure",
    aliases: ["docker"],
    patterns: [/\bdocker\b/i],
  }),
  skill({
    id: "kubernetes",
    label: "Kubernetes",
    category: "DevOps & Infrastructure",
    aliases: ["kubernetes", "k8s"],
    patterns: [/\bkubernetes\b/i, /\bk8s\b/i],
  }),
  skill({
    id: "terraform",
    label: "Terraform",
    category: "DevOps & Infrastructure",
    aliases: ["terraform"],
    patterns: [/\bterraform\b/i],
  }),
  skill({
    id: "linux",
    label: "Linux",
    category: "DevOps & Infrastructure",
    aliases: ["linux"],
    patterns: [/\blinux\b/i],
  }),
  skill({
    id: "github-actions",
    label: "GitHub Actions",
    category: "DevOps & Infrastructure",
    aliases: ["github actions"],
    patterns: [/\bgithub actions\b/i],
  }),
  skill({
    id: "jenkins",
    label: "Jenkins",
    category: "DevOps & Infrastructure",
    aliases: ["jenkins"],
    patterns: [/\bjenkins\b/i],
  }),
  skill({
    id: "machine-learning",
    label: "Machine Learning",
    category: "Data & AI",
    aliases: ["machine learning", "ml"],
    patterns: [/\bmachine learning\b/i, /\bml\b(?=\s+(?:model|engineer|pipeline|system|platform|ops)\b)/i],
  }),
  skill({
    id: "generative-ai",
    label: "Generative AI",
    category: "Data & AI",
    aliases: ["generative ai", "genai"],
    patterns: [/\bgenerative ai\b/i, /\bgenai\b/i],
  }),
  skill({
    id: "mlops",
    label: "MLOps",
    category: "Data & AI",
    aliases: ["mlops", "ml ops"],
    patterns: [/\bmlops\b/i, /\bml ops\b/i],
  }),
  skill({
    id: "tensorflow",
    label: "TensorFlow",
    category: "Data & AI",
    aliases: ["tensorflow"],
    patterns: [/\btensorflow\b/i],
  }),
  skill({
    id: "pytorch",
    label: "PyTorch",
    category: "Data & AI",
    aliases: ["pytorch", "py torch"],
    patterns: [/\bpytorch\b/i, /\bpy torch\b/i],
  }),
  skill({
    id: "cybersecurity",
    label: "Cybersecurity",
    category: "Security",
    aliases: ["cybersecurity", "cyber security", "information security", "application security"],
    patterns: [
      /\bcybersecurity\b/i,
      /\bcyber security\b/i,
      /\binformation security\b/i,
      /\bapplication security\b/i,
    ],
  }),
  skill({
    id: "figma",
    label: "Figma",
    category: "Product, Design & Collaboration",
    aliases: ["figma"],
    patterns: [/\bfigma\b/i],
  }),
  skill({
    id: "tableau",
    label: "Tableau",
    category: "Product, Design & Collaboration",
    aliases: ["tableau"],
    patterns: [/\btableau\b/i],
  }),
  skill({
    id: "power-bi",
    label: "Power BI",
    category: "Product, Design & Collaboration",
    aliases: ["power bi", "powerbi"],
    patterns: [/\bpower\s*bi\b/i],
  }),
  skill({
    id: "salesforce",
    label: "Salesforce",
    category: "Product, Design & Collaboration",
    aliases: ["salesforce"],
    patterns: [/\bsalesforce\b/i],
  }),
  skill({
    id: "hubspot",
    label: "HubSpot",
    category: "Product, Design & Collaboration",
    aliases: ["hubspot", "hub spot"],
    patterns: [/\bhubspot\b/i, /\bhub spot\b/i],
  }),
]);

export const SKILL_OPTIONS = Object.freeze(
  SKILL_REGISTRY.map(({ id, label, category, aliases }) => ({
    id,
    label,
    category,
    aliases,
  })).sort((left, right) => left.label.localeCompare(right.label, "en", { sensitivity: "base" })),
);

const SKILL_LOOKUP = new Map();
for (const skillEntry of SKILL_REGISTRY) {
  for (const token of [skillEntry.id, skillEntry.label, ...skillEntry.aliases]) {
    SKILL_LOOKUP.set(String(token).trim().toLowerCase(), skillEntry.id);
  }
}

export const resolveSkillToken = (value) =>
  SKILL_LOOKUP.get(String(value || "").trim().toLowerCase()) || null;

export const resolveSkillTokens = (values = []) => {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const resolved = resolveSkillToken(value);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    result.push(resolved);
  }

  return result;
};
