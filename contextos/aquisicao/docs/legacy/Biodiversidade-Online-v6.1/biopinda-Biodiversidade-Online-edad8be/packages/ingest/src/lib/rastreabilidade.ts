import type { Db, ObjectId } from 'mongodb'
import type { DocumentoOriginal } from '../types/documento-original.ts'

type GarantirRastreabilidadeOptions<TTransformed = Record<string, unknown>> = {
  collectionName: string
  originalId: ObjectId
  transformed: TTransformed
  metadata?: {
    pipelineVersion?: string
    transformFunctions?: string[]
  }
}

type ObterOriginalReferenciaOptions = {
  collectionName: string
  transformedId: ObjectId
}

type ObterTransformadosRelacionadosOptions = {
  collectionName: string
  originalId: ObjectId
}

const notImplemented = (fn: string): Error =>
  new Error(`Função não implementada: rastreabilidade.${fn}`)

export async function garantirRastreabilidadeBidirecional<
  TTransformed = Record<string, unknown>
>(
  _db: Db,
  _options: GarantirRastreabilidadeOptions<TTransformed>
): Promise<void> {
  throw notImplemented('garantirRastreabilidadeBidirecional')
}

export async function obterOriginalReferencia<TDados = Record<string, unknown>>(
  _db: Db,
  _options: ObterOriginalReferenciaOptions
): Promise<DocumentoOriginal<TDados> | null> {
  throw notImplemented('obterOriginalReferencia')
}

export async function obterTransformadosRelacionados<
  TTransformed = Record<string, unknown>
>(
  _db: Db,
  _options: ObterTransformadosRelacionadosOptions
): Promise<TTransformed[]> {
  throw notImplemented('obterTransformadosRelacionados')
}

export type {
  GarantirRastreabilidadeOptions,
  ObterOriginalReferenciaOptions,
  ObterTransformadosRelacionadosOptions
}
