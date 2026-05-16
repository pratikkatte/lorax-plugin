const TERMINAL_BACKEND_MESSAGES = new Set([
  'config loaded',
  'connected',
  'loaded',
])
const TERMINAL_BACKEND_PREFIXES = ['session restored']

export function formatBackendStatusMessage(statusMessage: unknown) {
  if (!statusMessage) {
    return ''
  }
  if (typeof statusMessage === 'string') {
    return statusMessage
  }
  if (typeof statusMessage !== 'object') {
    return ''
  }
  const candidate = statusMessage as {
    message?: unknown
    status?: unknown
  }
  const text = candidate.message ?? candidate.status ?? ''
  return typeof text === 'string' ? text : String(text)
}

export function getLoraxLoadingStatus({
  isConnected,
  hasLoadConfig,
  treeIsLoading,
  backendStatusMessage,
}: {
  isConnected: boolean
  hasLoadConfig: boolean
  treeIsLoading: boolean
  backendStatusMessage?: unknown
}) {
  if (!isConnected) {
    return 'Connecting to backend'
  }
  if (!hasLoadConfig) {
    return 'Loading config'
  }
  if (treeIsLoading) {
    return 'Loading trees'
  }

  const backendText = formatBackendStatusMessage(backendStatusMessage).trim()
  const normalizedBackendText = backendText.toLowerCase()
  if (
    backendText &&
    !TERMINAL_BACKEND_MESSAGES.has(normalizedBackendText) &&
    !TERMINAL_BACKEND_PREFIXES.some(prefix =>
      normalizedBackendText.startsWith(prefix),
    )
  ) {
    return backendText
  }
  return undefined
}
