export function parseOnchainError(error: unknown): string {
  const message = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (message.includes('user rejected') || (error as { code?: number })?.code === 4001) {
    return 'Transaction cancelled.'
  }
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Insufficient balance. Please add funds.'
  }
  if (message.includes('reverted')) {
    const reasonMatch = message.match(/reason="([^"]+)"/)
    return reasonMatch ? `Transaction failed: ${reasonMatch[1]}` : 'Transaction failed. Please try again.'
  }
  if (message.includes('network') || message.includes('timeout')) {
    return 'Network error. Please check your connection.'
  }
  return 'Something went wrong. Please try again.'
}
