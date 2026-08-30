export type DataOrigin = "organization" | "demonstration";

export interface OriginatedData {
  dataOrigin: DataOrigin;
}

export class DataOriginPolicy {
  requiresDisclosure(origin: DataOrigin): boolean {
    return origin === "demonstration";
  }
}
