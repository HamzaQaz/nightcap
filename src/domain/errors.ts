export type NotFound = { readonly tag: 'not_found'; readonly entity: string; readonly id: string }
export type Validation = {
  readonly tag: 'validation'
  readonly field: string
  readonly message: string
}
export type Conflict = { readonly tag: 'conflict'; readonly message: string }
export type ProviderError = {
  readonly tag: 'provider_error'
  readonly provider: 'henrik' | 'gemini' | 'discord'
  readonly kind: 'rate_limited' | 'unauthorized' | 'unavailable' | 'bad_response' | 'unknown'
  readonly message: string
}

export type DomainError = NotFound | Validation | Conflict | ProviderError

const TAGS = new Set<DomainError['tag']>(['not_found', 'validation', 'conflict', 'provider_error'])

export const notFound = (entity: string, id: string): NotFound => ({
  tag: 'not_found',
  entity,
  id,
})

export const validation = (field: string, message: string): Validation => ({
  tag: 'validation',
  field,
  message,
})

export const conflict = (message: string): Conflict => ({ tag: 'conflict', message })

export const providerError = (
  provider: ProviderError['provider'],
  kind: ProviderError['kind'],
  message: string,
): ProviderError => ({ tag: 'provider_error', provider, kind, message })

export const isDomainError = (x: unknown): x is DomainError =>
  typeof x === 'object' &&
  x !== null &&
  'tag' in x &&
  TAGS.has((x as { tag: DomainError['tag'] }).tag)
