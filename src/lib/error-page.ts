/**
 * O HTML de último recurso: sai deste processo quando o SSR já falhou, então
 * não pode depender de nada que o app carregue.
 *
 * SEM SCRIPT EMBUTIDO, DE PROPÓSITO (SEC-APP-006). O "Tentar novamente" já foi
 * `<button onclick="location.reload()">`. Funcionava só porque a CSP ainda
 * aceita `script-src 'unsafe-inline'`; no dia em que o SSR assinar o script de
 * hidratação com nonce e essa permissão sair, o botão morreria calado — nonce
 * não autoriza manipulador embutido, isso pediria `'unsafe-hashes'`. Um link
 * para a própria URL recarrega igual e não pede permissão nenhuma.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não carregou</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { font: 15px/1.5 system-ui, -apple-system, sans-serif; background: #fafafa; color: #111; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #4b5563; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #111; color: #fff; }
      .secondary { background: #fff; color: #111; border-color: #d1d5db; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Esta página não carregou</h1>
      <p>Algo deu errado do nosso lado. Você pode atualizar a página ou voltar ao início.</p>
      <div class="actions">
        <a class="primary" href="">Tentar novamente</a>
        <a class="secondary" href="/">Ir para o início</a>
      </div>
    </div>
  </body>
</html>`;
}
