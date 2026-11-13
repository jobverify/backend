import { readFileSync } from 'node:fs';
import { normalizeResumeLinks } from '../services/resumeSource.js';

const resumeUrlBreaks = Array.from("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./-?&=#_~:!,;()[]'+",
  character => '\\do' + (/[0-9]/.test(character) ? '' : '\\') + character).join('');

// The selected template is repository-owned code, never candidate input. Share
// its actual preamble between inference, preflight and compiler dependency setup.
export const RESUME_ABEY_TEMPLATE = readFileSync(new URL('../../resume-tailoring/templates/abey-resume.tex', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
  .replace('\\urlstyle{same}', `\\urlstyle{same}\n\\renewcommand{\\UrlBreaks}{${resumeUrlBreaks}}`);
export const RESUME_LATEX_PREAMBLE = RESUME_ABEY_TEMPLATE.slice(0,
  RESUME_ABEY_TEMPLATE.indexOf('\\begin{document}') + '\\begin{document}\n'.length);

export const RESUME_LATEX_BODY_COMMANDS = Object.freeze(['section', 'subsection', 'subsubsection', 'paragraph', 'textbf', 'textit', 'textsc', 'textsf', 'texttt',
  'textrm', 'textnormal', 'emph', 'underline', 'item', 'par', 'newline', 'linebreak', 'noindent', 'hfill',
  'hspace', 'vspace', 'newpage', 'pagebreak', 'small', 'normalsize', 'large', 'Large', 'LARGE', 'huge', 'Huge', 'scshape', 'bfseries',
  'textbar', 'textbullet', 'textendash', 'textemdash', 'textbackslash', 'textasciitilde', 'textasciicircum',
  'LaTeX', 'TeX', 'c', 'v', 'H', 'u', 'k', 'r', 'b', 'd', 't',
  'resumeItem', 'classesList', 'resumeSubheading', 'resumeSubSubheading', 'resumeProjectHeading', 'resumeSubItem',
  'resumeSubHeadingListStart', 'resumeSubHeadingListEnd', 'resumeItemListStart', 'resumeItemListEnd', 'sbullet',
  'faPhone', 'faEnvelope', 'faLinkedin', 'faLinkedinSquare', 'faGithub', 'faHackerrank', 'faPoll', 'faExternalLink', 'faGlobe']);
export const RESUME_LATEX_ENVIRONMENTS = Object.freeze(['center', 'flushleft', 'itemize', 'enumerate', 'description', 'multicols']);
const alternatives = values => values.map(value => JSON.stringify(value)).join(' | ');
export const resumeLatexLinkTarget = value => value.replace(/[&%_$#{}]/g, character => `\\${character}`);

// Word commands require a delimiter: otherwise an allowed accent such as \c
// followed by plain text could admit a forbidden command such as \catcode.
// \end{document} is accepted only once, at the end of the complete response.
export function buildResumeLatexGrammar(allowedLinks = []) {
  const targets = normalizeResumeLinks(allowedLinks).filter(link => !/%(?:0a|0d|00)/i.test(link) && !link.includes('\\')).map(resumeLatexLinkTarget);
  return [
    `root ::= ${JSON.stringify(RESUME_LATEX_PREAMBLE)} body ${JSON.stringify(String.raw`\end{document}`)} [ \\t\\r\\n]*`,
    `body ::= (text | symbol | command | environment${targets.length ? ' | hyperlink' : ''})*`,
    String.raw`text ::= [^\\\x00-\x08\x0B\x0E-\x1F]`,
    `symbol ::= ${JSON.stringify('\\')} (${alternatives(['\\', '%', '$', '&', '#', '_', '{', '}', ' ', '~', '^', ',', ';', ':', '!', "'", '`', '"', '=', '.'])})`,
    `command ::= ${JSON.stringify('\\')} (${alternatives(RESUME_LATEX_BODY_COMMANDS)}) [^A-Za-z\\\\]`,
    `environment ::= (${JSON.stringify(String.raw`\begin{`)} | ${JSON.stringify(String.raw`\end{`)}) (${alternatives(RESUME_LATEX_ENVIRONMENTS)}) "}"`,
    ...(targets.length ? [
      `hyperlink ::= (${JSON.stringify(String.raw`\href{`)} | ${JSON.stringify(String.raw`\url{`)}) link-target "}"`,
      `link-target ::= ${alternatives(targets)}`,
    ] : []),
  ].join('\n');
}

export const RESUME_LATEX_GRAMMAR = buildResumeLatexGrammar();

export const RESUME_LATEX_FORMAT_INSTRUCTION = [
  'Use the Abey Resume Template code below. Copy its preamble exactly through \\begin{document}, including the following newline, and replace the sample body with the candidate resume. Template sample names, employers, skills, dates and URLs are examples, never candidate facts. Do not add packages, redefine commands, change margins or create a different layout.',
  'BEGIN TRUSTED ABEY TEMPLATE CODE',
  RESUME_ABEY_TEMPLATE,
  'END TRUSTED ABEY TEMPLATE CODE',
  'Keep the sample leading \\vspace*{18pt} so the name has room above it, the centered name/contact header, ruled section headings, and template entry macros. Use \\resumeSubheading{employer or institution}{dates}{actual role or degree}{location}, \\resumeProjectHeading{project and tools}{dates}, and \\resumeItem inside the corresponding list macros. At least one entry or item macro is required; for a prose-only source, put its supported statements in \\resumeItem lists. Keep all four subheading arguments, using empty braces for unknown values. Include only source-supported sections; section order may follow the candidate resume. Do not copy sample sections with no candidate evidence.',
  `Use standard LaTeX line semantics: source newlines are whitespace, a blank line or \\par starts a paragraph, and \\\\ ends a header/skills row. Use ordinary text, escaped special characters, the environments ${RESUME_LATEX_ENVIRONMENTS.join(', ')}, and these body commands only: ${[...RESUME_LATEX_BODY_COMMANDS, 'href', 'url'].map(command => `\\${command}`).join(', ')}. For \\href and \\url, copy a latexTarget exactly from allowedLinkDestinations, including its escapes. Never invent or change a destination. Separate word commands with whitespace or {}. Use \\textbar{} instead of math mode. Use only the template-defined macros; never define new ones.`,
].join('\n');
