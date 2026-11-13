import { startBatchExtractor } from '../src/services/batchEligibilityExtraction.js';

let extractor;
try {
  extractor = await startBatchExtractor({ allowDownload: process.argv.includes('--download-assets'),
    ...(process.argv.includes('--verbose') ? { onCompletion: value => console.log(JSON.stringify(value)) } : {}) });
  console.log(JSON.stringify(extractor.validation));
} finally { await extractor?.stop(); }
