import { detectLocale } from "../i18n/registry";

/**
 * As palavras do jogo. A tela de erro vive FORA do provedor de idioma (é o
 * último recurso do app), então o jogo carrega o próprio vocabulário, nas
 * duas línguas da casa, e escolhe pela preferência do navegador.
 */
export interface CareerRunWording {
  readonly title: string;
  readonly invite: string;
  readonly levels: readonly [string, string, string];
  readonly score: string;
  readonly best: string;
  readonly evidences: string;
  readonly crashed: string;
  readonly again: string;
  readonly reducedMotion: string;
  readonly canvasLabel: string;
}

const PT: CareerRunWording = {
  title: "Enquanto isso, uma corrida de carreira",
  invite: "Espaço, seta para cima ou toque para pular as distâncias e recolher evidências.",
  levels: ["Júnior", "Pleno", "Sênior"],
  score: "Pontos",
  best: "Recorde",
  evidences: "Evidências",
  crashed: "Tropeçou numa distância. Recomendado: tentar novamente.",
  again: "Pular para recomeçar",
  reducedMotion: "Uma pessoa correndo pelo roteiro de carreira, pulando distâncias.",
  canvasLabel: "Corrida de carreira: pule as distâncias e recolha evidências",
};

const EN: CareerRunWording = {
  title: "Meanwhile, a career run",
  invite: "Space, arrow up or tap to jump the gaps and collect evidence.",
  levels: ["Junior", "Mid-level", "Senior"],
  score: "Points",
  best: "Best",
  evidences: "Evidence",
  crashed: "Tripped on a gap. Recommended: try again.",
  again: "Jump to restart",
  reducedMotion: "A person running along the career roadmap, jumping over gaps.",
  canvasLabel: "Career run: jump the gaps and collect evidence",
};

export class CareerRunWords {
  static for(languages: readonly string[]): CareerRunWording {
    return detectLocale(languages) === "en" ? EN : PT;
  }
}
