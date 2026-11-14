// Generated exports only. Original uploaded documents never pass this boundary.
const MAX_PDF_BYTES = 5 * 1024 * 1024;
const MAX_TEX_BYTES = 512 * 1024;
const PREFIX = '% Jobverify provenance: ';
const sourceType = 'http://cv.iptc.org/newscodes/digitalsourcetype/';
const bytesOf = value => Buffer.isBuffer(value) ? value : value instanceof Uint8Array
  ? Buffer.from(value) : Buffer.from(value?.buffer || []);
const invalid = () => Object.assign(new Error('The generated document could not be prepared for download. Please generate it again.'), { statusCode: 422 });

function provenance(modelVersion) {
  const aiAssisted = !String(modelVersion || '').startsWith('source-template:');
  return { version: 1, provider: 'Jobverify', aiAssisted,
    digitalSourceType: sourceType + (aiAssisted ? 'compositeWithTrainedAlgorithmicMedia' : 'algorithmicMedia') };
}

function xmp(meta) {
  // Deliberately excludes candidate data, model responses and user-controlled XML.
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:Iptc4xmpExt="http://ns.iptc.org/Iptc4xmpExt/2008-02-29/" xmlns:jv="https://www.jobverify.in/ns/provenance/1.0/">
<xmp:CreatorTool>Jobverify${meta.aiAssisted ? ' AI' : ''} resume export</xmp:CreatorTool>
<dc:format>application/pdf</dc:format><Iptc4xmpExt:DigitalSourceType rdf:resource="${meta.digitalSourceType}"/>
<jv:aiAssisted>${meta.aiAssisted}</jv:aiAssisted><jv:version>1</jv:version>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;
}

export async function generatedResumeBytes(artifact, format) {
  const meta = provenance(artifact?.modelVersion);
  if (format === 'tex') {
    let latex = bytesOf(artifact?.latex).toString('utf8');
    if (!latex.trim() || Buffer.byteLength(latex) > MAX_TEX_BYTES) throw invalid();
    if (latex.startsWith(PREFIX)) latex = latex.slice(latex.indexOf('\n') + 1);
    return Buffer.from(PREFIX + JSON.stringify(meta) + '\n' + latex);
  }
  if (format !== 'pdf') throw Object.assign(new Error('Choose PDF or TeX format.'), { statusCode: 400 });
  const input = bytesOf(artifact?.pdf);
  if (!input.length || input.length > MAX_PDF_BYTES || !input.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw invalid();
  try {
    const { PDFDocument, PDFName } = await import('pdf-lib');
    const pdf = await PDFDocument.load(input, { updateMetadata: false, throwOnInvalidObject: true });
    pdf.setCreator(`Jobverify${meta.aiAssisted ? ' AI' : ''} resume export`);
    pdf.setProducer('Jobverify');
    pdf.setSubject(meta.aiAssisted ? 'AI-assisted resume. Review for accuracy before use.' : 'Resume formatted by Jobverify.');
    pdf.setKeywords([meta.aiAssisted ? 'AI-assisted' : 'Algorithmically generated', 'Jobverify', meta.digitalSourceType]);
    const metadata = pdf.context.register(pdf.context.stream(Buffer.from(xmp(meta)), {
      Type: PDFName.of('Metadata'), Subtype: PDFName.of('XML'),
    }));
    pdf.catalog.set(PDFName.of('Metadata'), metadata);
    const result = Buffer.from(await pdf.save());
    if (result.length > MAX_PDF_BYTES) throw invalid();
    return result;
  } catch { throw invalid(); }
}

export function legacyResumeBytes(output, modelVersion) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) throw invalid();
  return Buffer.from(JSON.stringify({ ...output, _jobverifyProvenance: provenance(modelVersion) }, null, 2));
}
