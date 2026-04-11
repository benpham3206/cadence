export function getTrackLabel(isDrill, chunkMode, isTransfer) {
  if (isTransfer) return 'transfer';
  if (chunkMode) return 'B';
  if (isDrill) return 'A';
  return 'C';
}
