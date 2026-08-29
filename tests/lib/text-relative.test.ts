import { describe, expect, it } from "vitest";

import { DateFormatter } from "@/lib/text";

/**
 * O NoticeItem mostra tempo relativo ("há 2 horas") — a spec manda o cálculo
 * morar no DateFormatter de lib/text.ts, não solto no componente. Além de 30
 * dias a frase relativa vira ruído: cai na data absoluta já existente.
 */
describe("DateFormatter.formatRelative", () => {
  const formatter = new DateFormatter();
  const now = new Date("2026-08-28T12:00:00.000Z");

  it("minutos e horas recentes em pt", () => {
    expect(formatter.formatRelative("2026-08-28T11:58:00.000Z", "pt", now)).toBe("há 2 minutos");
    expect(formatter.formatRelative("2026-08-28T09:00:00.000Z", "pt", now)).toBe("há 3 horas");
  });

  it("dias em en", () => {
    expect(formatter.formatRelative("2026-08-26T10:00:00.000Z", "en", now)).toBe("2 days ago");
  });

  it("menos de um minuto fica em segundos, nunca 'há 0 minutos'", () => {
    const result = formatter.formatRelative("2026-08-28T11:59:30.000Z", "pt", now);
    expect(result).not.toContain("minuto");
    expect(result).toContain("30");
  });

  it("acima de 30 dias cai na data absoluta", () => {
    expect(formatter.formatRelative("2026-06-01T10:00:00.000Z", "pt", now)).toBe(
      formatter.formatDate("2026-06-01T10:00:00.000Z", "pt"),
    );
  });

  it("data inválida devolve null, como o formatDate", () => {
    expect(formatter.formatRelative("não-é-data", "pt", now)).toBeNull();
  });
});
