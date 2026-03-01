import { DocumentProcessorServiceClient } from '@google-cloud/documentai'

const PROJECT_ID = process.env['GOOGLE_DOCUMENT_AI_PROJECT_ID']
const PROCESSOR_ID = process.env['GOOGLE_DOCUMENT_AI_PROCESSOR_ID']
const LOCATION = 'us'

const COST_PER_PAGE_USD = 0.0015 // $1.50 per 1000 pages

export interface OcrResult {
  text: string
  pageCount: number
  pdfType: 'copyable' | 'scanned' | 'mixed'
  costUsd: number
}

function getClient(): DocumentProcessorServiceClient {
  return new DocumentProcessorServiceClient()
}

function getProcessorName(): string {
  if (!PROJECT_ID || !PROCESSOR_ID) {
    throw new Error(
      'GOOGLE_DOCUMENT_AI_PROJECT_ID and GOOGLE_DOCUMENT_AI_PROCESSOR_ID are required',
    )
  }
  return `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`
}

export async function processDocumentOcr(
  fileBuffer: Buffer,
  mimeType: 'application/pdf',
): Promise<OcrResult> {
  const client = getClient()
  const processorName = getProcessorName()

  const [result] = await client.processDocument({
    name: processorName,
    rawDocument: {
      content: fileBuffer.toString('base64'),
      mimeType,
    },
  })

  const document = result.document
  if (!document) {
    throw new Error('Document AI returned no document')
  }

  const text = document.text ?? ''
  const pageCount = document.pages?.length ?? 0

  // Heuristic to detect PDF type
  const hasOcrText = document.pages?.some((page) =>
    page.blocks?.some((block) => block.layout?.textAnchor?.textSegments?.length),
  )
  const hasNativeText = text.length > 0 && !hasOcrText

  let pdfType: OcrResult['pdfType']
  if (hasNativeText && hasOcrText) {
    pdfType = 'mixed'
  } else if (hasOcrText) {
    pdfType = 'scanned'
  } else {
    pdfType = 'copyable'
  }

  const costUsd = pageCount * COST_PER_PAGE_USD

  return { text, pageCount, pdfType, costUsd }
}
