// Interpretation only: callers retain the original employer text for hashing
// and provenance. A duration must describe previous work to become experience.
const number = '(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|eighteen)'
const unit = '(?:years?|yrs?|months?)'
const quantity = `${number}\\s*[- ]?\\s*${unit}`
const numberWords = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty']

export function normalizeExperienceEvidence(value) {
  let text = String(value || '').replace(/[\u2013\u2014]/g, '-')
    .replace(new RegExp('\\b(' + numberWords.join('|') + ')\\s*\\(\\s*(\\d+)\\s*\\)(?=\\s*' + unit + ')', 'gi'),
      (match, word, digits) => numberWords.indexOf(word.toLowerCase()) === Number(digits) ? digits : match)
    // Flattened headings must not make the preceding required work optional.
    .replace(/\b((?:required|minimum|preferred|basic(?:\s+job)?)\s+(?:qualifications?|requirements?))\s*:?\s*/gi, '\n$1:\n')
  // The unit belongs to the heading on these ATS pages, not the value line.
  text = text.replace(new RegExp('\\bexperience\\s*(?:required\\s*)?\\(\\s*(' + unit + ')\\s*\\)\\s*[:=-]?\\s*('
    + number + '\\s*(?:(?:-|to)\\s*' + number + ')?)(?=\\s*(?:\\n|$))', 'gi'),
  (_, units, bounds) => `Experience: ${bounds} ${units}\n`)
    .replace(new RegExp('\\bexperience\\s*-\\s*(?=' + number + '\\s*(?:-|to|\\+|' + unit + '))', 'gi'), 'Experience: ')
  // An upper limit permits zero; it does not impose the limit as a floor.
  text = text.replace(new RegExp('\\b(?:no\\s+more\\s+than|not\\s+more\\s+than|up\\s+to|at\\s+most|maximum(?:\\s+of)?)\\s+('
    + number + ')\\s*(' + unit + ')(?=[\\s\\S]{0,65}?\\bexperience\\b)', 'gi'), '0-$1 $2')
  text = text
    .replace(new RegExp('\\b(age(?:d)?(?:\\s+(?:limit|should|must|shall|be|is|not|above|below|over|under|at|most|least|of|maximum|minimum|up|to|than|more|less|exceed))*(?:\\s*[:<>=-])?\\s*)' + quantity, 'gi'), '$1age limit')
    .replace(new RegExp('\\b' + quantity + '\\s+(?:of\\s+age|old)\\b', 'gi'), 'age limit')
    .replace(new RegExp('\\b(?:within|in)\\s+(?:the\\s+)?(?:past\\s+|last\\s+)?' + quantity + '\\s+(?:of|since|after|from)\\s+graduation\\b', 'gi'), 'recent graduation')
    .replace(new RegExp('\\b((?:completed|finished|earned|obtained)\\b[^.;\\n]{0,80}?(?:degree|diploma))\\s+(?:within|in)\\s+(?:the\\s+)?(?:past|last)\\s+' + quantity, 'gi'), '$1 recently')
    .replace(new RegExp('\\b' + quantity + '\\s+(?:(?:development|training|apprenticeship)\\s+)*(?:program(?:me)?|apprenticeship)\\b', 'gi'),
      (match, offset, source) => {
        const suffix = source.slice(offset + match.length)
        // Prior work involving programmes is still work experience, including
        // occupations not known to a fixed list of programme-management roles.
        return /^\s+(?:[a-z-]+\s+){0,7}(?:experience|background|tenure)\b/i.test(suffix) ? match : 'training programme'
      })
  return text
}
