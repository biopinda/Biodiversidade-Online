/**
 * Transform orchestrator - executes atomic transform functions in sequence
 */

export type TransformFunction<TInput = any, TOutput = any> = (
  document: TInput
) => TOutput | null | Promise<TOutput | null>

export interface TransformStep<TInput = any, TOutput = any> {
  name: string
  fn: TransformFunction<TInput, TOutput>
  optional?: boolean // If true, null result doesn't fail the pipeline
}

export interface TransformPipeline<TInput = any, TOutput = any> {
  name: string
  steps: Array<TransformStep>
}

export interface TransformResult<T = any> {
  success: boolean
  document: T | null
  failedAt?: string
  error?: Error
}

/**
 * Execute a transform pipeline on a document
 * Each step receives the output of the previous step
 * If any required step returns null, the pipeline fails
 */
export async function executeTransformPipeline<TInput = any, TOutput = any>(
  pipeline: TransformPipeline<TInput, TOutput>,
  input: TInput
): Promise<TransformResult<TOutput>> {
  let current: any = input

  for (const step of pipeline.steps) {
    try {
      const result = await step.fn(current)

      if (result === null) {
        if (!step.optional) {
          return {
            success: false,
            document: null,
            failedAt: step.name
          }
        }
        // Optional step returned null, continue with current document
        continue
      }

      current = result
    } catch (error) {
      return {
        success: false,
        document: null,
        failedAt: step.name,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  return {
    success: true,
    document: current as TOutput
  }
}

/**
 * Create a transform step
 */
export function createTransformStep<TInput = any, TOutput = any>(
  name: string,
  fn: TransformFunction<TInput, TOutput>,
  optional = false
): TransformStep<TInput, TOutput> {
  return { name, fn, optional }
}

/**
 * Create a transform pipeline
 */
export function createTransformPipeline<TInput = any, TOutput = any>(
  name: string,
  steps: Array<TransformStep>
): TransformPipeline<TInput, TOutput> {
  return { name, steps }
}

/**
 * Compose multiple transform functions into a single function
 * Useful for creating reusable transform combinations
 */
export function composeTransforms<T = any>(
  ...transforms: Array<TransformFunction<T, T>>
): TransformFunction<T, T> {
  return async (document: T) => {
    let current = document
    for (const transform of transforms) {
      const result = await transform(current)
      if (result === null) return null
      current = result
    }
    return current
  }
}
