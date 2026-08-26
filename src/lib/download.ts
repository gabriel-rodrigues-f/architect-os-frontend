/**
 * OO3-11j — efeito de DOM extraído de `team-report-shared.ts` (que era
 * apresentação + efeito misturados): dispara o download de um Blob pelo
 * clique programático de uma âncora temporária.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
