// Image files on a paste event or drop, in order.
export const imageFiles = (list?: FileList | null) => Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));

// Reads a copied image (such as a screenshot) with the browser's clipboard permission. Returns null when the clipboard holds no image.
export async function readClipboardImage(): Promise<File | null> {
  for (const item of await navigator.clipboard.read()) {
    const type = item.types.find((t) => t.startsWith("image/"));
    if (type) return new File([await item.getType(type)], `pasted-image.${type.split("/")[1] || "png"}`, { type });
  }
  return null;
}

export const CLIPBOARD_EMPTY = "There is no image on the clipboard. Take a screenshot with copy to clipboard, then try again.";
export const CLIPBOARD_BLOCKED = "The browser did not allow clipboard access. Click this box and press Ctrl or ⌘ + V instead.";
