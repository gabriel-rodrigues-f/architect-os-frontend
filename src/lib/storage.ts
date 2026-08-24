/**
 * R2-VIS-10 (SYNAPSE-DIRECIONAMENTO-EXECUCAO.md) — metade das chaves de
 * `localStorage` nasceu com o prefixo antigo `architect-os:`
 * (tema/idioma/sidebar), enquanto chaves mais novas (grupos recolhidos do
 * menu) já usam `synapse:`. Migração de leitura: lê a chave nova; se estiver
 * vazia, cai para a antiga, promove o valor para a chave nova e apaga a
 * antiga — sessões já abertas não perdem a preferência salva, e a partir daí
 * só a chave nova é lida ou escrita.
 */
export function readMigratedItem(newKey: string, legacyKey: string): string | null {
  try {
    const atual = window.localStorage.getItem(newKey);
    if (atual !== null) return atual;
    const antigo = window.localStorage.getItem(legacyKey);
    if (antigo !== null) {
      window.localStorage.setItem(newKey, antigo);
      window.localStorage.removeItem(legacyKey);
    }
    return antigo;
  } catch {
    // localStorage indisponível (modo privado) — nasce sem preferência salva.
    return null;
  }
}
