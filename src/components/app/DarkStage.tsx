import { useEffect, type ReactNode } from "react";

import { useThemeIfAny } from "@/lib/theme";

/**
 * O PALCO ESCURO. Dono (2026-09-08): "a tela inicial do Synapse é sempre
 * escura. Quando eu mudava para o tema branco e deslogava, a tela inicial
 * ficava branca. Nossa tela de login é sempre a escura. O tema só é aplicado
 * depois de realizado o login."
 *
 * Segura o `<html>` no escuro enquanto estiver montado — o que cobre também o
 * corpo, a barra de rolagem, o toaster e o spinner de carga, e não só a
 * cena de autenticação (que já se pintava por conta própria). A preferência
 * salva não é tocada: ela volta a valer no instante em que o palco sai de
 * cena, isto é, quando a sessão abre.
 */
export function DarkStage({ children }: { children: ReactNode }) {
  const theme = useThemeIfAny();
  const holdDark = theme?.holdDark;
  // Sem provedor (testes de tela isolada) o palco não tem o que segurar.
  useEffect(() => holdDark?.(), [holdDark]);
  return <>{children}</>;
}
