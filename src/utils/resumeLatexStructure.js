import { RESUME_LATEX_ENVIRONMENTS } from './resumeLatexFormat.js';

const listPairs = new Map([
  ['resumeSubHeadingListStart', 'resumeSubHeadingListEnd'],
  ['resumeItemListStart', 'resumeItemListEnd'],
]);
const listEnds = new Set(listPairs.values());
const sections = new Set(['section', 'subsection', 'subsubsection', 'paragraph']);
const headingEntries = new Set(['resumeSubheading', 'resumeSubSubheading', 'resumeProjectHeading']);
const itemEntries = new Set(['item', 'resumeItem', 'resumeSubItem', 'classesList']);
const itemEnvironments = new Set(['itemize', 'enumerate', 'description']);
const nameFonts = new Set(['Huge', 'huge', 'LARGE', 'Large', 'large', 'scshape']);

export function resumeLatexHeaderIssue(body) {
  for (const header of body.matchAll(/\\begin\{center\}([\s\S]*?)\\end\{center\}/g)) {
    let depth = 0;
    for (const token of header[1].matchAll(/%[^\r\n]*|\\([A-Za-z]+|[^\r\n])|[{}]/g)) {
      if (token[0][0] === '%') continue;
      if (token[0] === '{') depth++;
      else if (token[0] === '}') depth--;
      else if (nameFonts.has(token[1]) && depth <= 0) return 'Group the large name font inside braces, close that group, and use \\\\ followed by \\normalsize for a separate contact row. Never apply the name font to contacts.';
    }
  }
  return null;
}

// Inspect body commands, not template macro definitions. Consume escaped
// symbols and comments as tokens so neither can fabricate a closing command.
export function resumeLatexStructureIssue(body, lineOffset = 0) {
  const stack = [];
  let line = lineOffset + 1, previous = 0;
  for (const match of body.matchAll(/%[^\r\n]*|\\(begin|end)\s*\{([^}]+)\}|\\([A-Za-z]+|[^\r\n])/g)) {
    line += (body.slice(previous, match.index).match(/\n/g) || []).length;
    const atLine = line;
    line += (match[0].match(/\n/g) || []).length;
    previous = match.index + match[0].length;
    if (match[0][0] === '%') continue;
    const command = match[3];
    const top = stack.at(-1);
    const before = token => top
      ? `Close ${top.close} before ${token} at line ${atLine} (opened at line ${top.line}).`
      : `Remove the unmatched ${token} at line ${atLine}.`;
    if (headingEntries.has(command) && top?.kind !== 'heading') return `Use \\resumeSubHeadingListStart before \\${command} at line ${atLine}, then close it with \\resumeSubHeadingListEnd.`;
    if (itemEntries.has(command) && top?.kind !== 'item') return `Use \\resumeItemListStart before \\${command} at line ${atLine}, then close it with \\resumeItemListEnd.`;
    if (sections.has(command) && top) return before(`\\${command}`);
    if (command === 'resumeSubHeadingListStart' && top) return before(`\\${command}`);
    if (listPairs.has(command)) stack.push({ close: `\\${listPairs.get(command)}`, line: atLine, kind: command === 'resumeSubHeadingListStart' ? 'heading' : 'item' });
    else if (listEnds.has(command)) {
      if (top?.close !== `\\${command}`) return before(`\\${command}`);
      stack.pop();
    } else if (match[1]) {
      const name = match[2];
      if (name === 'document' && match[1] === 'end') {
        if (top) return before('\\end{document}');
      } else if (!RESUME_LATEX_ENVIRONMENTS.includes(name)) return 'Use only the supported template environments.';
      else if (match[1] === 'begin') stack.push({ close: `\\end{${name}}`, line: atLine, kind: itemEnvironments.has(name) ? 'item' : 'environment' });
      else {
        const close = `\\end{${name}}`;
        if (top?.close !== close) return before(close);
        stack.pop();
      }
    }
  }
  const top = stack.at(-1);
  return top ? `Close ${top.close} opened at line ${top.line} before ending the document.` : null;
}
