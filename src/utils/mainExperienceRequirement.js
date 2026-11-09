const experiencePattern = () => /\b(?:(?:minimum(?:\s+of)?|at[\s-]*least|more than|over)\s+)?\d+(?:\.\d+)?\s*(?:\+|plus)?(?:\s*(?:-|to)\s*\d+(?:\.\d+)?)?\s*(?:months?|years?|yrs?)'?\s+(?:of\s+)?(?:(?:overall|total|professional|relevant|industry|work|working)\s+)?experience\b/gi;
const qualificationHeadings = text => [...text.matchAll(/\b(?:required|minimum|basic|preferred|desirable)\s+(?:qualifications?|requirements?|experience)|\bqualifications?\s+and\s+experience\b|\bnice[- ]to[- ]have\b/gi)];
const preferred = value => /\b(?:preferred|desirable|nice[- ]to[- ]have)\b/i.test(value);
const clauseEnd = value => {
  const index = value.search(/[;,\n]|\.(?:\s|$)/);
  return index < 0 ? value.length : index;
};

// Preserve conditional degree paths as evidence instead of inventing one
// unconditional numeric minimum from a later specialty requirement.
export function alternativeExperienceRequirement(value) {
  const text = String(value || '').replace(/[\u2018\u2019]/g, "'");
  const matches = [...text.matchAll(experiencePattern())];
  const headings = qualificationHeadings(text);
  const firstRequired = headings.find(heading => !preferred(heading[0]));
  for (let index = 0; index < matches.length - 1; index += 1) {
    const left = matches[index];
    const right = matches[index + 1];
    const prefixStart = Math.max(0, left.index - 200);
    const prefix = text.slice(prefixStart, left.index);
    const degree = [...prefix.matchAll(/\b(?:bachelor(?:'s)?|master(?:'s)?|ph\.?d)\b\.?/gi)].at(-1);
    if (!degree || /[.;\n]/.test(prefix.slice(degree.index + degree[0].length))) continue;
    const between = text.slice(left.index + left[0].length, right.index);
    if (!/\bor\b[\s\S]{0,200}\b(?:bachelor(?:'s)?|master(?:'s)?|ph\.?d)\b/i.test(between)) continue;
    const start = prefixStart + degree.index;
    if (firstRequired && start < firstRequired.index) continue;
    if (preferred(headings.findLast(heading => heading.index < start)?.[0] || '')) continue;
    const end = right.index + right[0].length;
    const evidence = text.slice(start, end + clauseEnd(text.slice(end))).trim();
    if (!preferred(evidence)) return evidence;
  }
  return null;
}

// Select the role requirement before parsing its numeric value. A later minimum
// for one tool or market must not replace the main experience requirement.
export function mainExperienceRequirement(value) {
  const text = String(value || '').replace(/[\u2018\u2019]/g, "'");
  const matches = [...text.matchAll(experiencePattern())];
  if (matches.length < 2) return null;

  // Degree-dependent alternatives need the existing parser or explicit source
  // field; selecting the first path would overstate the requirement.
  if (/\b(?:in lieu|alternatively|equivalent combination)\b|\b(?:bachelor|master|ph\.?d)[\s\S]{0,160}\bor\b[\s\S]{0,100}\b(?:bachelor|master|ph\.?d)/i.test(text)) return null;

  const headings = qualificationHeadings(text);
  const firstRequired = headings.find(heading => !/preferred|desirable|nice[- ]to[- ]have/i.test(heading[0]));

  const candidates = matches.filter(match => {
    if (firstRequired && match.index < firstRequired.index) return false;
    const before = text.slice(0, match.index);
    const heading = headings.findLast(heading => heading.index < match.index)?.[0] || '';
    if (/preferred|desirable|nice[- ]to[- ]have/i.test(heading)) return false;
    const tail = text.slice(match.index + match[0].length);
    if (preferred(tail.slice(0, clauseEnd(tail)))) return false;
    return !/\b(?:our company|the company|we have|our history)\b[^.]{0,70}$/i.test(before);
  });
  if (!candidates.length) return null;
  const overall = candidates.find(match => /\b(?:overall|total)\b/i.test(match[0])
    || /\b(?:overall|total)\s*[:\-]?\s*$/i.test(text.slice(0, match.index)));
  return (overall || candidates[0])[0];
}
