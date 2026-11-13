// A known source label followed by a capitalized fragment is a common ATS
// flattening seam. Recover whitespace only; ordinary "responsibilities include"
// prose and conditional continuations are deliberately left alone.
export const descriptionHeadingNames = String.raw`(?:Good[- ]to[- ]Have Technical Skills|Professional Attributes\s*&\s*Qualifications|Mandatory Technical Skills|Required Technical Skills|Preferred Technical Skills|Key Responsibilities|Main Responsibilities|Core Responsibilities|Required Qualifications|Preferred Qualifications|Minimum Qualifications|Basic Qualifications|Technical Skills|Effective Teams|Required Skills|Preferred Skills|Role Summary|Role Overview|Job Description|Job Summary|Job Requirements|Application Details|Qualifications|Requirements|Responsibilities|Benefits|Overview|Skills)`;
const labels = descriptionHeadingNames;
const pattern = new RegExp('(?<!\\S)(' + labels + ')[ \\t]+(?=\\S)', 'gi');

export const descriptionInlineSpans = source => [...source.matchAll(/(`+)[^`\n]*\1|\[[^\]\n]*\](?:\([^\n]*?\))?|~~[^\n]*?~~|\*\*[^\n]*?\*\*|__[^\n]*?__/g)]
  .map(match => [match.index, match.index + match[0].length]);

export function collapsedDescriptionHeadings(source) {
  const spans = descriptionInlineSpans(source);
  return [...source.matchAll(pattern)].filter(match => {
    const after = source.slice(match.index + match[0].length);
    return !spans.some(([start, end]) => match.index >= start && match.index < end)
      && /^\p{Lu}/u.test(match[1]) && /^[\p{Lu}\d]/u.test(after);
  }).map(match => ({ start: match.index,
    end: match.index + match[0].length, title: match[1], kind: 'heading' }));
}

export function recoverDescriptionHeadings(source) {
  let offset = 0;
  const parts = [];
  for (const heading of collapsedDescriptionHeadings(source)) {
    const prefix = source.slice(offset, heading.start);
    parts.push(prefix.trimEnd(), prefix.trim() ? '\n\n' : '', heading.title, '\n\n');
    offset = heading.end;
  }
  return parts.length ? parts.join('') + source.slice(offset) : source;
}
