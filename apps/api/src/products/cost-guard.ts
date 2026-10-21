interface CostRow { id?: string | null; costPaise?: number | null }

// Someone who may not see cost prices must not wipe or change them by saving a product: the costs on file are kept as they are.
export function keepCosts<T extends { costPaise?: number | null; options?: CostRow[] }>(dto: T, existing: { costPaise?: number | null; options?: CostRow[] } | null): T {
  const old = new Map((existing?.options ?? []).map((o) => [o.id, o.costPaise ?? undefined]));
  return {
    ...dto,
    costPaise: existing?.costPaise ?? undefined,
    ...(dto.options ? { options: dto.options.map((o) => ({ ...o, costPaise: o.id ? old.get(o.id) : undefined })) } : {}),
  };
}
