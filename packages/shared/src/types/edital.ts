export type EditalStatus =
  | 'uploaded'
  | 'ocr_processing'
  | 'extracting'
  | 'review_pending'
  | 'ready'
  | 'error'

export type PdfType = 'copyable' | 'scanned' | 'mixed'

export type ModalidadeLicitacao =
  | 'pregao_eletronico'
  | 'pregao_presencial'
  | 'concorrencia'
  | 'tomada_de_precos'
  | 'convite'
  | 'leilao'
  | 'concurso'
  | 'rdc'
  | 'credenciamento'
  | 'outro'

export type RequisitoStatus =
  | 'ai_extracted'
  | 'human_approved'
  | 'human_edited'
  | 'human_rejected'

export type RequisitoCategoria =
  | 'qualificacao_tecnica'
  | 'qualificacao_economica'
  | 'regularidade_fiscal'
  | 'habilitacao_juridica'
  | 'outro'

export interface Edital {
  id: string
  tenantId: string
  uploadedBy: string
  fileName: string
  fileUrl: string
  pageCount: number | null
  pdfType: PdfType | null
  status: EditalStatus
  orgaoLicitante: string | null
  numeroEdital: string | null
  modalidade: ModalidadeLicitacao | null
  objeto: string | null
  valorEstimado: number | null
  dataAbertura: Date | null
  aiExtractionCostUsd: number | null
  ocrCostUsd: number | null
  createdAt: Date
  updatedAt: Date
}

export interface EditalRequisito {
  id: string
  tenantId: string
  editalId: string
  lote: string | null
  categoria: RequisitoCategoria
  descricao: string
  trechoOriginal: string | null
  paginaReferencia: number | null
  quantitativoExigido: number | null
  unidade: string | null
  aiConfidenceScore: number
  status: RequisitoStatus
  editedBy: string | null
  createdAt: Date
  updatedAt: Date
}
