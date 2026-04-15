/**
 * Compute new sort orders after moving an item up or down in a list.
 * Returns the full list of { id, sort_order } to send to the reorder API.
 */
export function computeReorder<T extends { id: string }>(
  items: T[],
  itemId: string,
  direction: "up" | "down",
): { id: string; sort_order: number }[] | null {
  const idx = items.findIndex((item) => item.id === itemId);
  if (idx < 0) return null;

  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) return null;

  return items.map((item, i) => {
    if (i === idx) return { id: item.id, sort_order: swapIdx };
    if (i === swapIdx) return { id: item.id, sort_order: idx };
    return { id: item.id, sort_order: i };
  });
}

/**
 * Call a reorder API endpoint. Returns true on success.
 */
export async function submitReorder(
  endpoint: string,
  key: string,
  ordered: { id: string; sort_order: number }[],
): Promise<boolean> {
  try {
    const res = await fetch(endpoint, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: ordered }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
