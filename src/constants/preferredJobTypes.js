export const PREFERRED_JOB_TYPES = [
  "Intern",
  "Full-time Fresher",
  "Full-time Experienced",
  "Contract",
];

const PREFERRED_JOB_TYPE_ALIASES = {
  Intern: ["Intern", "Internship"],
  "Full-time Fresher": ["Full-time Fresher"],
  "Full-time Experienced": ["Full-time Experienced", "Full-time"],
  Contract: ["Contract"],
};

export const normalizePreferredJobType = (value) => {
  const normalized = String(value || "").trim().toLowerCase();

  if (!normalized) return null;
  if (normalized === "intern" || normalized === "internship") return "Intern";

  return (
    PREFERRED_JOB_TYPES.find((jobType) => jobType.toLowerCase() === normalized)
    ?? null
  );
};

export const isPreferredJobType = (value) =>
  normalizePreferredJobType(value) !== null;

export const getPreferredJobTypeMatches = (value) => {
  const canonical = normalizePreferredJobType(value);
  return canonical ? PREFERRED_JOB_TYPE_ALIASES[canonical] : [];
};
