import { Oklch } from "@/lib/design";

export type ColorVisionDeficiency = "protanopia" | "deuteranopia" | "tritanopia";

export const DICHROMACIES: readonly ColorVisionDeficiency[] = ["protanopia", "deuteranopia"];

export const SEPARATION = {
  distinguishable: 8,
  floor: 6,
} as const;

type Matrix = readonly (readonly [number, number, number])[];

const SIMULATION_MATRICES: Record<ColorVisionDeficiency, Matrix> = {
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

const clamp01 = (valor: number) => Math.min(1, Math.max(0, valor));

const toRadians = (graus: number) => (graus * Math.PI) / 180;

const toDegrees = (radianos: number) => ((radianos * 180) / Math.PI + 360) % 360;

function toOklab(cor: Oklch): [number, number, number] {
  const angulo = toRadians(cor.h);
  return [cor.l, cor.c * Math.cos(angulo), cor.c * Math.sin(angulo)];
}

function toLinearRgb(cor: Oklch): [number, number, number] {
  const [luminosidade, a, b] = toOklab(cor);

  const longa = (luminosidade + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const media = (luminosidade - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const curta = (luminosidade - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * longa - 3.3077115913 * media + 0.2309699292 * curta,
    -1.2684380046 * longa + 2.6097574011 * media - 0.3413193965 * curta,
    -0.0041960863 * longa - 0.7034186147 * media + 1.707614701 * curta,
  ];
}

function fromLinearRgb([r, g, b]: [number, number, number]): Oklch {
  const longa = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const media = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const curta = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const luminosidade = 0.2104542553 * longa + 0.793617785 * media - 0.0040720468 * curta;
  const eixoVermelho = 1.9779984951 * longa - 2.428592205 * media + 0.4505937099 * curta;
  const eixoAmarelo = 0.0259040371 * longa + 0.7827717662 * media - 0.808675766 * curta;

  return new Oklch(
    luminosidade,
    Math.hypot(eixoVermelho, eixoAmarelo),
    toDegrees(Math.atan2(eixoAmarelo, eixoVermelho)),
  );
}

export function simulateColorVision(cor: Oklch, deficiency: ColorVisionDeficiency): Oklch {
  const [r, g, b] = toLinearRgb(cor);
  const matriz = SIMULATION_MATRICES[deficiency];

  return fromLinearRgb([
    clamp01(matriz[0]![0] * r + matriz[0]![1] * g + matriz[0]![2] * b),
    clamp01(matriz[1]![0] * r + matriz[1]![1] * g + matriz[1]![2] * b),
    clamp01(matriz[2]![0] * r + matriz[2]![1] * g + matriz[2]![2] * b),
  ]);
}

export function perceptualDistance(uma: Oklch, outra: Oklch): number {
  const [l1, a1, b1] = toOklab(uma);
  const [l2, a2, b2] = toOklab(outra);
  return 100 * Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

export function separationUnder(
  uma: Oklch,
  outra: Oklch,
  deficiency: ColorVisionDeficiency,
): number {
  return perceptualDistance(
    simulateColorVision(uma, deficiency),
    simulateColorVision(outra, deficiency),
  );
}

export interface WorstSeparation {
  readonly deficiency: ColorVisionDeficiency;
  readonly distance: number;
}

export function worstSeparation(
  uma: Oklch,
  outra: Oklch,
  deficiencies: readonly ColorVisionDeficiency[] = DICHROMACIES,
): WorstSeparation {
  return deficiencies
    .map((deficiency) => ({ deficiency, distance: separationUnder(uma, outra, deficiency) }))
    .reduce<WorstSeparation>((pior, atual) => (atual.distance < pior.distance ? atual : pior), {
      deficiency: "deuteranopia",
      distance: Infinity,
    });
}

export function areDistinguishableByColorAlone(uma: Oklch, outra: Oklch): boolean {
  return worstSeparation(uma, outra).distance >= SEPARATION.distinguishable;
}
