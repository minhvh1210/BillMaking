export const CARGO_TYPES = [
  { key: "FCL_IMPORT", label: "FCL Import", group: "Sea" },
  { key: "FCL_EXPORT", label: "FCL Export", group: "Sea" },
  { key: "LCL_IMPORT", label: "LCL Import", group: "Sea" },
  { key: "LCL_EXPORT", label: "LCL Export", group: "Sea" },
  { key: "CONSOL_IMPORT", label: "Consol Import", group: "Sea" },
  { key: "CONSOL_EXPORT", label: "Consol Export", group: "Sea" },
  { key: "AIR_IMPORT", label: "Air Import", group: "Air" },
  { key: "AIR_EXPORT", label: "Air Export", group: "Air" },
  { key: "FTL", label: "FTL", group: "Road" },
  { key: "LTL", label: "LTL", group: "Road" },
  { key: "LOGISTICS", label: "Logistics", group: "Other" },
] as const;

export type CargoTypeKey = (typeof CARGO_TYPES)[number]["key"];

const CARGO_KEYS = new Set<string>(CARGO_TYPES.map((c) => c.key));

export function isCargoTypeKey(value: string): value is CargoTypeKey {
  return CARGO_KEYS.has(value);
}

export function cargoTypeLabel(key: string): string {
  return CARGO_TYPES.find((c) => c.key === key)?.label ?? key;
}

/** Thứ tự hiển thị theo danh sách chuẩn */
export function cargoTypeOrder(key: string): number {
  const index = CARGO_TYPES.findIndex((c) => c.key === key);
  return index === -1 ? CARGO_TYPES.length : index;
}
