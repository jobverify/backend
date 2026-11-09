import { getDocument, VerbosityLevel } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas } from '@napi-rs/canvas'
import { createWorker } from 'tesseract.js'

const normalizePdfWhitespace = (value) => String(value ?? '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\n{3,}/g, '\n\n')
  .trim()

const OCR_RENDER_SCALE = 2
const OCR_MAX_PAGES = 2
const OCR_WORKER_COUNT = 2
const DEFAULT_PDF_TEXT_EXTRACTION_TIMEOUT_MS = 30 * 1000

let ocrWorkerPoolPromise = null
let ocrWorkerCursor = 0

export class PdfTextExtractionTimeoutError extends Error {
  constructor(timeoutMs) {
    super(`PDF text extraction timed out after ${timeoutMs}ms`)
    this.name = 'PdfTextExtractionTimeoutError'
    this.localTimeout = true
    this.failureKind = 'pdf_text_timeout'
  }
}

export const resolvePdfTextExtractionTimeoutMs = (
  value = process.env.PDF_TEXT_EXTRACTION_TIMEOUT_MS,
  fallback = DEFAULT_PDF_TEXT_EXTRACTION_TIMEOUT_MS,
) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10)
  if (!Number.isFinite(parsed) || parsed < 0) return fallback
  return parsed
}

const getAbortReason = (signal, fallbackMessage) => (
  signal?.reason || new Error(fallbackMessage)
)

const throwIfAborted = (signal, fallbackMessage = 'PDF text extraction aborted') => {
  if (signal?.aborted) {
    throw getAbortReason(signal, fallbackMessage)
  }
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { signal: null, dispose: () => {} }
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new PdfTextExtractionTimeoutError(timeoutMs))
  }, timeoutMs)

  return {
    signal: controller.signal,
    dispose: () => clearTimeout(timeoutId),
  }
}

const raceWithAbortSignals = async (promise, signals = []) => {
  const activeSignals = signals.filter(Boolean)
  for (const signal of activeSignals) {
    throwIfAborted(signal)
  }

  if (activeSignals.length === 0) return promise

  let settled = false
  const cleanups = []
  const abortPromise = new Promise((_, reject) => {
    for (const signal of activeSignals) {
      const onAbort = () => {
        reject(getAbortReason(signal, 'PDF text extraction aborted'))
      }
      signal.addEventListener('abort', onAbort, { once: true })
      cleanups.push(() => signal.removeEventListener('abort', onAbort))
    }
  })

  try {
    return await Promise.race([
      promise.finally(() => {
        settled = true
      }),
      abortPromise,
    ])
  } finally {
    for (const cleanup of cleanups) cleanup()
    if (!settled) {
      promise.catch(() => {})
    }
  }
}

const toPdfUint8Array = (value) => {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value)
  }

  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  }

  return new Uint8Array(value)
}

const getOcrWorkerPool = async () => {
  ocrWorkerPoolPromise ??= Promise.all(
    Array.from({ length: OCR_WORKER_COUNT }, () => createWorker('eng')),
  ).then((workers) => ({
    workers,
    queues: workers.map(() => Promise.resolve()),
  }))

  return ocrWorkerPoolPromise
}

const renderPdfPageToPng = async (page) => {
  const viewport = page.getViewport({ scale: OCR_RENDER_SCALE })
  const canvas = createCanvas(
    Math.max(1, Math.ceil(viewport.width)),
    Math.max(1, Math.ceil(viewport.height)),
  )
  const context = canvas.getContext('2d')
  await page.render({
    canvasContext: context,
    viewport,
  }).promise
  return canvas.toBuffer('image/png')
}

const extractTextFromPdfWithOcr = async (pdf) => {
  const pageCount = Math.min(pdf.numPages, OCR_MAX_PAGES)
  if (pageCount === 0) return ''

  const pool = await getOcrWorkerPool()
  const pages = []

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const imageBuffer = await renderPdfPageToPng(page)
    const workerIndex = ocrWorkerCursor % pool.workers.length
    ocrWorkerCursor += 1
    const resultPromise = pool.queues[workerIndex].then(
      () => pool.workers[workerIndex].recognize(imageBuffer),
      () => pool.workers[workerIndex].recognize(imageBuffer),
    )
    pool.queues[workerIndex] = resultPromise.catch(() => {})
    const result = await resultPromise
    const pageText = normalizePdfWhitespace(result?.data?.text)
    if (pageText) {
      pages.push(pageText)
    }
  }

  return pages.join('\n\n')
}

export const extractTextFromPdfBuffer = async (value, {
  signal = null,
  timeoutMs = resolvePdfTextExtractionTimeoutMs(),
} = {}) => {
  throwIfAborted(signal)
  const pdfData = toPdfUint8Array(value)
  const loadingTask = getDocument({
    data: pdfData,
    useWorkerFetch: false,
    isEvalSupported: false,
    verbosity: VerbosityLevel.ERRORS,
  })

  const timeout = createTimeoutSignal(timeoutMs)
  const abortSignals = [signal, timeout.signal]
  const extractionPromise = (async () => {
    const pdf = await loadingTask.promise
    const pages = []

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber)
      const textContent = await page.getTextContent()
      const fragments = []

      for (const item of textContent.items) {
        if (!item || typeof item.str !== 'string') continue

        const text = item.str.trim()
        if (!text) continue

        fragments.push(text)
        if (item.hasEOL) {
          fragments.push('\n')
        }
      }

      const pageText = normalizePdfWhitespace(fragments.join(' '))
      if (pageText) {
        pages.push(pageText)
      }
    }

    const directText = pages.join('\n\n')
    if (pages.length > 0) {
      return directText
    }

    const ocrText = await extractTextFromPdfWithOcr(pdf)
    return ocrText || directText
  })()

  try {
    return await raceWithAbortSignals(extractionPromise, abortSignals)
  } finally {
    timeout.dispose()
    await loadingTask.destroy()
  }
}
