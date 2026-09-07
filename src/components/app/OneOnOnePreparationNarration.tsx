import { AdviceText } from "@/components/app/ai-shared";
import { SectionHeading } from "@/components/app/SectionHeading";
import {
  OneOnOnePreparationReading,
  OneOnOnePreparationSections,
  type TitledText,
} from "@/lib/one-on-one-preparation";

/**
 * A narração da preparação do 1:1, desenhada por seção na ordem que o dono
 * pediu (2026-09-07): liturgia → resumo do perfil → SWOT. Cada seção ganha o
 * cabeçalho da casa (`SectionHeading`), e o SWOT vira grade 2×2 quando o
 * texto trouxer os quatro quadrantes — senão, texto corrido.
 *
 * Sem os títulos (narrador determinístico, provedor que não obedeceu), o
 * texto é desenhado como todo texto de IA: a tela não inventa seção que o
 * texto não trouxe.
 */
export function OneOnOnePreparationNarration({ text }: { text: string }) {
  const reading = OneOnOnePreparationReading.of(text);
  if (reading === null) return <AdviceText text={text} />;
  return (
    <div className="mt-2 space-y-4" data-testid="one-on-one-preparation">
      {reading.preamble !== "" && <AdviceText text={reading.preamble} />}
      {reading.sections.map((section) => (
        <section key={section.title} aria-label={section.title}>
          <SectionHeading as="h3">{section.title}</SectionHeading>
          {section.title === OneOnOnePreparationSections.TITLES.swot ? (
            <SwotBody text={section.text} />
          ) : (
            <AdviceText text={section.text} />
          )}
        </section>
      ))}
    </div>
  );
}

function SwotBody({ text }: { text: string }) {
  const quadrants = OneOnOnePreparationReading.swotQuadrantsOf(text);
  if (quadrants === null) return <AdviceText text={text} />;
  return (
    <div className="mt-2 grid gap-3 sm:grid-cols-2" data-testid="swot-grid">
      {quadrants.map((quadrant) => (
        <SwotQuadrant key={quadrant.title} quadrant={quadrant} />
      ))}
    </div>
  );
}

function SwotQuadrant({ quadrant }: { quadrant: TitledText }) {
  return (
    <section aria-label={quadrant.title} className="rounded-md border border-border bg-card p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {quadrant.title}
      </p>
      <AdviceText text={quadrant.text} className="mt-1" />
    </section>
  );
}
