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
  'textquoteleft', 'textquoteright', 'textquotedblleft', 'textquotedblright', 'i',
  'LaTeX', 'TeX', 'c', 'v', 'H', 'u', 'k', 'r', 'b', 'd', 't',
  'resumeItem', 'classesList', 'resumeSubheading', 'resumeSubSubheading', 'resumeProjectHeading', 'resumeSubItem',
  'resumeSubHeadingListStart', 'resumeSubHeadingListEnd', 'resumeItemListStart', 'resumeItemListEnd', 'sbullet',
  'faPhone', 'faEnvelope', 'faLinkedin', 'faLinkedinSquare', 'faGithub', 'faHackerrank', 'faPoll', 'faExternalLink', 'faGlobe']);
export const RESUME_LATEX_ENVIRONMENTS = Object.freeze(['center', 'flushleft', 'itemize', 'enumerate', 'description', 'multicols']);
const alternatives = values => values.map(value => JSON.stringify(value)).join(' | ');
export const resumeLatexLinkTarget = value => value.replace(/[&%_$#{}]/g, character => `\\${character}`);
// PDF extraction can detach a diaeresis from its dotless base. Compose that
// letter before TeX can give the standalone accent a misleading text mapping.
export const resumeLatexText = value => value.replace(/\u00a8[ \t]*\u0131/g, '\u00ef').replace(/[\\{}$&#%_^~]/g, character => ({
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '%': '\\%',
  '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
})[character]).replace(/[‘’“”ı]/g, character => ({
  '‘': String.raw`\textquoteleft{}`, '’': String.raw`\textquoteright{}`,
  '“': String.raw`\textquotedblleft{}`, '”': String.raw`\textquotedblright{}`, 'ı': String.raw`\i{}`,
})[character]);

function orderedSectionRules(layout, twoPages, content, scopedHeaders, includeHeader) {
  const sections = layout.sections;
  const breakIndex = twoPages ? sections.indexOf(layout.pageBreakBefore) : -1;
  const plannedBreak = breakIndex > 0;
  const extra = layout.extraSectionTitles?.length ? ' | extra-section' : '';
  const itemLimit = title => (!twoPages || plannedBreak) && Number.isInteger(layout.sectionItemLimits?.[title]) ? layout.sectionItemLimits[title] : 0;
  const scopedBlocks = scopedHeaders || sections.some(title => itemLimit(title));
  const block = index => scopedBlocks ? `block-${index}` : 'block';
  return [
    `body ::= front ${twoPages && !plannedBreak ? 'before' : 'after'}-section-0`,
    layout.contactHeader ? `front ::= ${JSON.stringify(includeHeader ? layout.contactHeader : '')}` : `front ::= (${content}${extra})*`,
    ...(scopedBlocks ? sections.flatMap((title, index) => itemLimit(title) ? [
      `block-${index} ::= [ \\t\\r\\n]* bounded-item-list-${index} [ \\t\\r\\n]*`,
      `bounded-item-list-${index} ::= ${JSON.stringify(String.raw`\resumeItemListStart`)} boundary [ \\t\\r\\n]* bounded-item{1,${itemLimit(title)}} ${JSON.stringify(String.raw`\resumeItemListEnd`)} boundary`,
    ] : scopedHeaders && layout.sectionHeaderChoices[title].length && (!twoPages || plannedBreak) ? [
      // Confident, source-ordered entries form one finite list. Neither an
      // inner entry loop nor a second list may reproduce the same source job.
      `block-${index} ::= [ \\t\\r\\n]* heading-list-${index} [ \\t\\r\\n]*`,
      `heading-list-${index} ::= ${JSON.stringify(String.raw`\resumeSubHeadingListStart`)} boundary [ \\t\\r\\n]* `
        + layout.sectionHeaderChoices[title].map(header => `${JSON.stringify(header)} content`).join(' ')
        + ` ${JSON.stringify(String.raw`\resumeSubHeadingListEnd`)} boundary`,
    ] : [
      `block-${index} ::= (${content} | heading-list-${index}${extra})*`,
      `required-entry-${index} ::= heading-list-${index} | item-list`,
      ...headingListRules(content, scopedHeaders ? layout.sectionHeaderChoices[title] : [], `-${index}`, !scopedHeaders),
    ]) : [`block ::= (${content} | heading-list${extra})*`]),
    ...sections.map((title, index) => `section-${index} ::= ${JSON.stringify(`\\section{${resumeLatexText(title)}}`)}`),
    ...(extra ? [`extra-section ::= ${alternatives(layout.extraSectionTitles.map(title => `\\section{${resumeLatexText(title)}}`))}`] : []),
    ...sections.map((_, index) => `after-section-${index} ::= section-${index} ${block(index)} ${plannedBreak && index + 1 === breakIndex ? 'page-break ' : ''}after-section-${index + 1}`),
    `after-section-${sections.length} ::= ""`,
    ...(twoPages && !plannedBreak ? sections.map((_, index) => `before-section-${index} ::= ` + [
      ...(index < sections.length - 1 ? [`section-${index} ${block(index)} before-section-${index + 1}`] : []),
      ...(index > 0 ? [`page-break after-section-${index}`] : []),
      `section-${index} ${block(index)} page-break [ \\t\\r\\n]* required-entry${scopedBlocks ? `-${index}` : ''} ${block(index)} after-section-${index + 1}`,
    ].join(' | ')) : []),
  ];
}

function preservedBodyRules(layout, twoPages, includeHeader) {
  const blocks = layout.preservationBlocks;
  const planned = twoPages && Number.isInteger(layout.preservationBreak)
    && layout.preservationBreak > 0 && layout.preservationBreak < blocks.length;
  return [
    `body ::= front preserved-${twoPages && !planned ? 'before' : 'after'}-0`,
    `front ::= ${JSON.stringify(includeHeader ? layout.contactHeader : '')}`,
    ...blocks.map((block, index) => `preserved-unit-${index} ::= ` + (layout.condenseOriginal && block.parts
      ? block.parts.map(part => typeof part === 'string' ? JSON.stringify(part) : 'narrative-content').join(' ')
      : JSON.stringify(block.latex))),
    ...blocks.map((_, index) => `preserved-after-${index} ::= preserved-unit-${index} preserved-space ${planned && index + 1 === layout.preservationBreak ? 'page-break ' : ''}preserved-after-${index + 1}`),
    `preserved-after-${blocks.length} ::= ""`,
    ...(twoPages && !planned ? blocks.map((_, index) => `preserved-before-${index} ::= ` + [
      ...(index < blocks.length - 1 ? [`preserved-unit-${index} preserved-space preserved-before-${index + 1}`] : []),
      ...(index > 0 ? [`page-break preserved-after-${index}`] : []),
    ].join(' | ')) : []),
    `preserved-space ::= [ \\t\\r\\n]{0,2} (${alternatives([String.raw`\vspace{2pt}`, String.raw`\vspace{4pt}`])})? [ \\t\\r\\n]{0,2}`,
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
export function buildResumeLatexGrammar(allowedLinks = [], pagination = {}, { includePreamble = true, includeHeader = true, sectionTitles = [], layout, headerChoices = [] } = {}) {
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
    ...(layout?.preservationBlocks?.length && layout.contactHeader ? preservedBodyRules(layout, twoPages, includeHeader)
      : layout?.sections?.length ? orderedSectionRules(layout, twoPages, content, scopedHeaders, includeHeader) : [
      twoPages ? `body ::= ${layout?.contactHeader ? 'front ' : ''}page page-break second-page` : `body ::= ${layout?.contactHeader ? 'front ' : ''}page`,
      ...(layout?.contactHeader ? [`front ::= ${JSON.stringify(includeHeader ? layout.contactHeader : '')}`] : []),
      `page ::= (${content} | section | heading-list)*`,
      ...(twoPages ? ['second-page ::= page required-entry page'] : []),
    ]),
    ...(twoPages ? [
      `page-break ::= ${JSON.stringify(String.raw`\newpage`)} boundary [ \\t\\r\\n]* ${JSON.stringify(String.raw`\vspace*{24pt}`)} [ \\t\\r\\n]*`,
      'required-entry ::= heading-list | item-list',
    ] : []),
    `content ::= (${content})*`,
    String.raw`text ::= [^\\\x00-\x08\x0B\x0E-\x1F]`,
    `bounded-item ::= ${JSON.stringify(String.raw`\resumeItem{`)} inline-content "}" [ \\t\\r\\n]*`,
    `inline-content ::= (inline-text | symbol | inline-group | inline-format | inline-icon${targets.length ? ' | hyperlink' : ''})*`,
    'narrative-content ::= (inline-text | symbol | narrative-group | narrative-format)*',
    'narrative-group ::= "{" narrative-content "}"',
    `narrative-format ::= ${JSON.stringify('\\')} (${alternatives(['textbf', 'textit', 'emph', 'underline'])}) "{" narrative-content "}"`,
    String.raw`inline-text ::= [^\\{}\x00-\x08\x0B\x0E-\x1F]`,
    'inline-group ::= "{" inline-content "}"',
    `inline-format ::= ${JSON.stringify('\\')} (${alternatives(['textbf', 'textit', 'textsc', 'textsf', 'texttt', 'textrm', 'textnormal', 'emph', 'underline'])}) "{" inline-content "}"`,
    `inline-icon ::= ${JSON.stringify('\\')} (${alternatives(RESUME_LATEX_BODY_COMMANDS.filter(name => name.startsWith('fa') || ['textbar', 'textbullet', 'LaTeX', 'TeX'].includes(name)))}) "{}"`,
    `symbol ::= ${JSON.stringify('\\')} (${alternatives(['\\', '%', '$', '&', '#', '_', '{', '}', ' ', '~', '^', ',', ';', ':', '!', "'", '`', '"', '=', '.'])})`,
    `command ::= ${JSON.stringify('\\')} (${alternatives(RESUME_LATEX_BODY_COMMANDS.filter(name => !structuralCommands.has(name)))}) [^A-Za-z\\\\]`,
    sectionTitles.length
      ? `section ::= ${alternatives(sectionTitles.map(title => `\\section{${resumeLatexText(title)}}`))}`
      : `section ::= ${JSON.stringify('\\')} (${alternatives(sectionCommands)}) [^A-Za-z\\\\]`,
    `environment ::= ${RESUME_LATEX_ENVIRONMENTS.filter(name => !layout?.contactHeader || name !== 'center').map(name => `${JSON.stringify(`\\begin{${name}}`)} ${name === 'center' ? 'header-content' : ['itemize', 'enumerate', 'description'].includes(name) ? 'item-content' : 'content'} ${JSON.stringify(`\\end{${name}}`)}`).join(' | ')}`,
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
  'Start the body with \\vspace*{18pt}. Use the centered Abey header, ruled sections and template entry macros; include only substantive source-supported sections, never empty sample sections or sample facts.',
  'Use \\resumeSubheading{employer or institution}{dates}{actual role or degree}{location}, keeping all four arguments and {} for unknown values. Use \\resumeProjectHeading{project and supported tools}{source dates}, with dates in argument two. These and \\resumeSubSubheading must be directly inside \\resumeSubHeadingListStart ... \\resumeSubHeadingListEnd; every \\resumeItem or \\resumeSubItem belongs inside \\resumeItemListStart ... \\resumeItemListEnd or itemize.',
  'Start each list with its first entry/item, never an empty list. Close item lists and heading lists before the next \\section; do not nest heading lists. Separate word/list commands with whitespace or {}. A prose-only source still needs supported statements in \\resumeItem lists.',
  'In \\begin{center}, group only the source name as {\\Huge \\scshape candidate name}, then \\\\ and \\normalsize before contacts. Show each contact once. Source newlines are whitespace, not row breaks: use \\\\ to end a header/skills row, and blank lines or \\par for paragraphs.',
  'Use ordinary escaped text, template macros and standard text formatting. Use \\textbar{} instead of math mode. For \\href or \\url, copy a latexTarget exactly from allowedLinkDestinations. Never change a destination, define commands or add dependencies.',
].join('\n');

export const RESUME_LATEX_FORMAT_INSTRUCTION = [
  'Use the Abey Resume Template code below. Its actual preamble and macros define the layout. The template sample body is omitted so sample facts and unsupported sections cannot become candidate content. Fill the body using only the original candidate resume. Copy the preamble exactly through \\begin{document}, including its following newline. Do not add packages, redefine commands, change margins or create a different layout.',
  'BEGIN TRUSTED ABEY TEMPLATE CODE',
  RESUME_LATEX_PREAMBLE + '\\end{document}',
  'END TRUSTED ABEY TEMPLATE CODE',
  resumeLatexBodyInstructions,
].join('\n');

export const RESUME_LATEX_PREFILL_INSTRUCTION = [
  'The assistant response already begins with the complete, exact Abey Resume Template preamble through \\begin{document}. A known original contact header may follow in that prefix. Read the supplied code and continue after the entire prefix, using only the original candidate resume and ending with \\end{document}. Do not repeat any prefix content: if the header is supplied, continue with the first source section. Its actual macros define the layout. Do not add packages, redefine commands, change margins or create a different layout. Template sample facts are never candidate facts.',
  resumeLatexBodyInstructions,
].join('\n');
