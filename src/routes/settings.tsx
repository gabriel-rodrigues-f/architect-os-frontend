import { createFileRoute, Navigate } from "@tanstack/react-router";

/**
 * O ENDEREÇO ANTIGO NÃO VIRA 404.
 *
 * `/settings` hospedou "Critérios de Progressão" — 1390 linhas e três
 * alcances numa tela só — até a decisão do dono de 2026-09-10 transformar o
 * menu em GRUPO, com seis fatias. Quem tem link salvo, quem veio de um aviso
 * e quem está com a aba aberta continua chegando aqui, e o endereço leva à
 * primeira fatia: Elegibilidade.
 *
 * O redirecionamento é do COMPONENTE, não uma guarda de `beforeLoad`, e isso
 * é decisão, não acaso: a guarda de navegação de uma rota é a declaração de
 * quem a alcança (`tests/architecture/alcance-por-rota.test.ts`), e este
 * endereço não decide alcance nenhum — quem decide é o destino, cada um com
 * o dono dele. Aqui vale a régua de quem já está logado, e nada mais.
 */
export const Route = createFileRoute("/settings")({
  component: LegacyProgressionCriteriaAddress,
});

function LegacyProgressionCriteriaAddress() {
  return <Navigate to="/eligibility" replace />;
}
