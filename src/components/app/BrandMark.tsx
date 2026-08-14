import { cn } from "@/lib/utils";

/**
 * Marca do Architect OS: um "A" construído como diagrama — vértices e arestas —
 * sobre quadrado de cantos arredondados.
 *
 * É SVG, não bitmap: escala sem borrar em qualquer densidade de tela, pesa
 * poucos bytes e o traço acompanha o tema por `currentColor` no fundo.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Architect OS"
      className={cn("h-8 w-8", className)}
    >
      <rect x="0" y="0" width="64" height="64" rx="15" fill="#0b1a24" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="14.25"
        fill="none"
        stroke="#5eead4"
        strokeOpacity="0.28"
      />

      <g
        stroke="#2ee6d6"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {/* hastes do A */}
        <path d="M32 17 L18.5 47" />
        <path d="M32 17 L45.5 47" />
        {/* travessão */}
        <path d="M21.5 32 H42.5" />
      </g>

      {/* pilar central: o "prumo" do arquiteto */}
      <path d="M28.6 34.5 L32 31.6 L35.4 34.5 V50 H28.6 Z" fill="#2ee6d6" fillOpacity="0.62" />

      {/* vértices do diagrama */}
      <g fill="#3df0e0">
        <circle cx="32" cy="13.5" r="3.6" />
        <circle cx="19.6" cy="31.8" r="3.5" />
        <circle cx="44.4" cy="31.8" r="3.5" />
        <circle cx="17" cy="47.6" r="4.1" />
        <circle cx="47" cy="47.6" r="4.1" />
      </g>
    </svg>
  );
}
