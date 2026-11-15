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
export const resumeLatexText = value => value.replace(/[\\{}$&#%_^~]/g, character => ({
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '%': '\\%',
  '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
})[character]);

function orderedSectionRules(layout, twoPages, content, scopedHeaders) {
  const sections = layout.sections;
  const breakIndex = twoPages ? sections.indexOf(layout.pageBreakBefore) : -1;
  const plannedBreak = breakIndex > 0;
  const extra = layout.extraSectionTitles?.length ? ' | extra-section' : '';
  const block = index => scopedHeaders ? `block-${index}` : 'block';
  return [
    `body ::= front ${twoPages && !plannedBreak ? 'before' : 'after'}-section-0`,
    `front ::= (${content}${extra})*`,
    ...(scopedHeaders ? sections.flatMap((title, index) => [
      `block-${index} ::= (${content} | heading-list-${index}${extra})*`,
      `required-entry-${index} ::= heading-list-${index} | item-list`,
      ...headingListRules(content, layout.sectionHeaderChoices[title], `-${index}`, false),
    ]) : [`block ::= (${content} | heading-list${extra})*`]),
    ...sections.map((title, index) => `section-${index} ::= ${JSON.stringify(`\\section{${resumeLatexText(title)}}`)}`),
    ...(extra ? [`extra-section ::= ${alternatives(layout.extraSectionTitles.map(title => `\\section{${resumeLatexText(title)}}`))}`] : []),
    ...sections.map((_, index) => `after-section-${index} ::= section-${index} ${block(index)} ${plannedBreak && index + 1 === breakIndex ? 'page-break ' : ''}after-section-${index + 1}`),
    `after-section-${sections.length} ::= ""`,
    ...(twoPages && !plannedBreak ? sections.map((_, index) => `before-section-${index} ::= ` + [
      ...(index < sections.length - 1 ? [`section-${index} ${block(index)} before-section-${index + 1}`] : []),
      ...(index > 0 ? [`page-break after-section-${index}`] : []),
      `section-${index} ${block(index)} page-break [ \\t\\r\\n]* required-entry${scopedHeaders ? `-${index}` : ''} ${block(index)} after-section-${index + 1}`,
    ].join(' | ')) : []),
  ];
}

function headingListRules(content, headers, suffix = '', allowGenericSubheading = !headers.length) {
  return [
    `heading-list${suffix} ::= ${JSON.stringify(String.raw`\resumeSubHeadingListStart`)} boundary [ \\t\\r\\n]* entry-command${suffix} heading-content${suffix} ${JSON.stringify(String.raw`\resumeSubHeadingListEnd`)} boundary`,
    `heading-content${suffix} ::= (${content} | entry-command${suffix})*`,
    `entry-command${suffix} ::= ${headers.length ? `candidate-header${suffix} | ` : ''}${JSON.stringify('\\')} (${alternatives([...(allowGenericSubheading ? ['resumeSubheading'] : []), 'resumeSubSubheading', 'resumeProjectHeading'])}) [^A-Za-z\\\\]`,
    ...(headers.length ? [`candidate-header${suffix} ::= ${alternatives(headers)}`] : []),
  ];
}

// Word commands require a delimiter: otherwise an allowed accent such as \c
// followed by plain text could admit a forbidden command such as \catcode.
// \end{document} is accepted only once, at the end of the complete response.
export function buildResumeLatexGrammar(allowedLinks = [], pagination = {}, { includePreamble = true, sectionTitles = [], layout, headerChoices = [] } = {}) {
  const targets = normalizeResumeLinks(allowedLinks).filter(link => !/%(?:0a|0d|00)/i.test(link) && !link.includes('\\')).map(resumeLatexLinkTarget);
  const sectionCommands = ['section', 'subsection', 'subsubsection', 'paragraph'];
  const structuralCommands = new Set([...sectionCommands, 'resumeSubHeadingListStart', 'resumeSubHeadingListEnd', 'resumeItemListStart', 'resumeItemListEnd',
    'resumeSubheading', 'resumeSubSubheading', 'resumeProjectHeading', 'resumeItem', 'resumeSubItem', 'classesList', 'item',
    'Huge', 'huge', 'LARGE', 'Large', 'large', 'scshape']);
  if (pagination.exact) for (const command of ['newpage', 'pagebreak']) structuralCommands.add(command);
  const twoPages = pagination.exact && pagination.targetPages === 2;
  const content = `text | symbol | command | environment | item-list${targets.length ? ' | hyperlink' : ''}`;
  const scopedHeaders = headerChoices.length > 0 && layout?.sections?.length > 0
    && layout.sections.every(title => Array.isArray(layout.sectionHeaderChoices?.[title]));
  return [
    `root ::= ${includePreamble ? JSON.stringify(RESUME_LATEX_PREAMBLE) + ' ' : ''}body ${JSON.stringify(String.raw`\end{document}`)} [ \\t\\r\\n]*`,
    ...(layout?.sections?.length ? orderedSectionRules(layout, twoPages, content, scopedHeaders) : [
      twoPages ? 'body ::= page page-break second-page' : 'body ::= page',
      `page ::= (${content} | section | heading-list)*`,
      ...(twoPages ? ['second-page ::= page required-entry page'] : []),
    ]),
    ...(twoPages ? [
      `page-break ::= ${JSON.stringify(String.raw`\newpage`)} boundary [ \\t\\r\\n]* ${JSON.stringify(String.raw`\vspace*{24pt}`)} [ \\t\\r\\n]*`,
      'required-entry ::= heading-list | item-list',
    ] : []),
    `content ::= (${content})*`,
    String.raw`text ::= [^\\\x00-\x08\x0B\x0E-\x1F]`,
    `symbol ::= ${JSON.stringify('\\')} (${alternatives(['\\', '%', '$', '&', '#', '_', '{', '}', ' ', '~', '^', ',', ';', ':', '!', "'", '`', '"', '=', '.'])})`,
    `command ::= ${JSON.stringify('\\')} (${alternatives(RESUME_LATEX_BODY_COMMANDS.filter(name => !structuralCommands.has(name)))}) [^A-Za-z\\\\]`,
    sectionTitles.length
      ? `section ::= ${alternatives(sectionTitles.map(title => `\\section{${resumeLatexText(title)}}`))}`
      : `section ::= ${JSON.stringify('\\')} (${alternatives(sectionCommands)}) [^A-Za-z\\\\]`,
    `environment ::= ${RESUME_LATEX_ENVIRONMENTS.map(name => `${JSON.stringify(`\\begin{${name}}`)} ${name === 'center' ? 'header-content' : ['itemize', 'enumerate', 'description'].includes(name) ? 'item-content' : 'content'} ${JSON.stringify(`\\end{${name}}`)}`).join(' | ')}`,
    `header-content ::= (${content} | name-style)*`,
    `name-style ::= ${JSON.stringify(String.raw`{\Huge \scshape `)} name-text "}" [ \\t\\r\\n]* ${JSON.stringify(String.raw`\\`)} [ \\t\\r\\n]* ${JSON.stringify(String.raw`\normalsize`)} boundary`,
    String.raw`name-text ::= ([^\\{}\x00-\x1F] | "\\" ("&" | "%" | "_" | "#" | "$" | "{" | "}" | "textbackslash{}" | "textasciitilde{}" | "textasciicircum{}"))+`,
    ...headingListRules(content, headerChoices),
    `item-list ::= ${JSON.stringify(String.raw`\resumeItemListStart`)} boundary [ \\t\\r\\n]* item-command item-content ${JSON.stringify(String.raw`\resumeItemListEnd`)} boundary`,
    `item-content ::= (${content} | item-command)*`,
    `item-command ::= ${JSON.stringify('\\')} (${alternatives(['item', 'resumeItem', 'resumeSubItem', 'classesList'])}) [^A-Za-z\\\\]`,
    String.raw`boundary ::= [ \t\r\n] | "{}"`,
    ...(targets.length ? [
      `hyperlink ::= (${JSON.stringify(String.raw`\href{`)} | ${JSON.stringify(String.raw`\url{`)}) link-target "}"`,
      `link-target ::= ${alternatives(targets)}`,
    ] : []),
  ].join('\n');
}

export const RESUME_LATEX_GRAMMAR = buildResumeLatexGrammar();

const resumeLatexBodyInstructions = [
  'Start the body with \\vspace*{18pt} so the name has room above it. Use a centered name/contact header, ruled section headings, and template entry macros. Use \\resumeSubheading{employer or institution}{dates}{actual role or degree}{location}, \\resumeProjectHeading{project and tools}{dates}, and \\resumeItem inside the corresponding list macros. Close each \\resumeItemListStart with \\resumeItemListEnd, then close \\resumeSubHeadingListStart with \\resumeSubHeadingListEnd before the next \\section. Never nest heading lists across sections. Put whitespace or {} after list macros. At least one entry or item macro is required; for a prose-only source, put its supported statements in \\resumeItem lists. Keep all four subheading arguments, using empty braces for unknown values. Include only source-supported sections. Never add empty sample sections or statements such as No certifications listed.',
  'Every \\resumeSubheading, \\resumeSubSubheading and \\resumeProjectHeading emits a LaTeX item and must be directly inside \\resumeSubHeadingListStart ... \\resumeSubHeadingListEnd, including Education and Projects. Every \\resumeItem and \\resumeSubItem must be inside \\resumeItemListStart ... \\resumeItemListEnd or a standard itemize list. Never place an entry or item macro directly after a section heading without its list wrapper. Start each Abey list with its first entry/item, and do not create empty lists.',
  'Keep the Abey header style: put only the source candidate name in a braced {\\Huge \\scshape candidate name} group inside the centered header, followed by \\\\ and \\normalsize before its separate contact row. A source newline or \\vspace alone does not end a name row or reset its font. Show each contact once. In \\resumeProjectHeading, argument one holds the source project name and supported tools, and argument two holds its dates; do not concatenate the dates into argument one and leave argument two empty.',
  `Use standard LaTeX line semantics: source newlines are whitespace, a blank line or \\par starts a paragraph, and \\\\ ends a header/skills row. Use ordinary text, escaped special characters, the environments ${RESUME_LATEX_ENVIRONMENTS.join(', ')}, and these body commands only: ${[...RESUME_LATEX_BODY_COMMANDS, 'href', 'url'].map(command => `\\${command}`).join(', ')}. For \\href and \\url, copy a latexTarget exactly from allowedLinkDestinations, including its escapes. Never invent or change a destination. Separate word commands with whitespace or {}. Use \\textbar{} instead of math mode. Use only the template-defined macros; never define new ones.`,
].join('\n');

export const RESUME_LATEX_FORMAT_INSTRUCTION = [
  'Use the Abey Resume Template code below. Its actual preamble and macros define the layout. The template sample body is omitted so sample facts and unsupported sections cannot become candidate content. Fill the body using only the original candidate resume. Copy the preamble exactly through \\begin{document}, including its following newline. Do not add packages, redefine commands, change margins or create a different layout.',
  'BEGIN TRUSTED ABEY TEMPLATE CODE',
  RESUME_LATEX_PREAMBLE + '\\end{document}',
  'END TRUSTED ABEY TEMPLATE CODE',
  resumeLatexBodyInstructions,
].join('\n');

export const RESUME_LATEX_PREFILL_INSTRUCTION = [
  'The assistant response already begins with the complete, exact Abey Resume Template preamble through \\begin{document}. Read that supplied code and continue its body using only the original candidate resume, ending with \\end{document}. Its actual macros define the layout. Do not repeat the preamble, add packages, redefine commands, change margins or create a different layout. Template sample facts are never candidate facts.',
  resumeLatexBodyInstructions,
].join('\n');
