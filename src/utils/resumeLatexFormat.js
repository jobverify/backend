import { normalizeResumeLinks } from '../services/resumeSource.js';

// Decode into the same cached compiler format on every attempt. Candidate prose,
// section order, achievements and job-specific wording still come from the model.
export const RESUME_LATEX_PREAMBLE = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=0.7in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{lmodern,enumitem,hyperref}
\pagestyle{empty}
\hypersetup{hidelinks}
\setlength{\parindent}{0pt}
\setlist[itemize]{leftmargin=*,nosep}
\renewcommand{\\}[1][0pt]{\par}
\begin{document}
\obeylines
`;

const bodyCommands = ['section', 'subsection', 'subsubsection', 'paragraph', 'textbf', 'textit', 'textsc', 'textsf', 'texttt',
  'textrm', 'textnormal', 'emph', 'underline', 'item', 'par', 'newline', 'linebreak', 'noindent', 'hfill',
  'hspace', 'vspace', 'newpage', 'pagebreak', 'small', 'normalsize', 'large', 'Large', 'LARGE',
  'textbar', 'textbullet', 'textendash', 'textemdash', 'textbackslash', 'textasciitilde', 'textasciicircum',
  'LaTeX', 'TeX', 'c', 'v', 'H', 'u', 'k', 'r', 'b', 'd', 't'];
const environments = ['center', 'flushleft', 'itemize', 'enumerate', 'description'];
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
    `command ::= ${JSON.stringify('\\')} (${alternatives(bodyCommands)}) [^A-Za-z\\\\]`,
    `environment ::= (${JSON.stringify(String.raw`\begin{`)} | ${JSON.stringify(String.raw`\end{`)}) (${alternatives(environments)}) "}"`,
    ...(targets.length ? [
      `hyperlink ::= (${JSON.stringify(String.raw`\href{`)} | ${JSON.stringify(String.raw`\url{`)}) link-target "}"`,
      `link-target ::= ${alternatives(targets)}`,
    ] : []),
  ].join('\n');
}

export const RESUME_LATEX_GRAMMAR = buildResumeLatexGrammar();

export const RESUME_LATEX_FORMAT_INSTRUCTION = [
  'Start with this exact compiler-supported preamble, including its final newline. Do not add packages, definitions or preamble commands:',
  RESUME_LATEX_PREAMBLE,
  `After that preamble, write the complete candidate resume, then \\end{document}. Body newlines end paragraphs: keep every header and achievement on its own line, and keep each command and its arguments on one physical line. Use ordinary text, escaped special characters, the environments ${environments.join(', ')}, and these commands only: ${[...bodyCommands, 'href', 'url'].map(command => `\\${command}`).join(', ')}. For \\href and \\url, copy a latexTarget exactly from allowedLinkDestinations, including its escapes. Never invent or change a destination. Separate word commands from following commands with whitespace. Do not use math mode or custom macros.`,
].join('\n');
