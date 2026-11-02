export interface ProductBarcode {
  gtin: string;
  lot?: string;
  serial?: string;
}

/** Normalize UPC-E output from a decoder before the ordinary GTIN check. */
export function expandUPCE(value: string): string {
  if (!/^[01]\d{7}$/.test(value)) throw new Error("Invalid UPC-E barcode.");
  const [system, a, b, c, d, e, last, check] = value;
  if ("012".includes(last))
    return `${system}${a}${b}${last}0000${c}${d}${e}${check}`;
  if (last === "3") return `${system}${a}${b}${c}00000${d}${e}${check}`;
  if (last === "4") return `${system}${a}${b}${c}${d}00000${e}${check}`;
  return `${system}${a}${b}${c}${d}${e}0000${last}${check}`;
}

export function parseBarcode(raw: string, format?: string): ProductBarcode {
  let value = raw.trim();
  const result: ProductBarcode = { gtin: "" };
  if (/^https?:\/\//i.test(value)) {
    let link: URL;
    try {
      link = new URL(value);
    } catch {
      throw new Error(
        "That QR code does not contain a valid GS1 Digital Link.",
      );
    }
    const match = link.pathname.match(/\/01\/(\d{14})(?:\/|$)/);
    if (!match)
      throw new Error(
        "This QR code is not a product code. Use a UPC/EAN barcode or a GS1 link containing /01/ and a 14-digit GTIN.",
      );
    value = match[1];
    for (const [key, ai] of [
      ["lot", "10"],
      ["serial", "21"],
    ] as const) {
      const part = link.pathname.match(new RegExp(`/${ai}/([^/]+)`))?.[1];
      try {
        result[key] =
          (part ? decodeURIComponent(part) : link.searchParams.get(ai))?.slice(
            0,
            100,
          ) || undefined;
      } catch {
        throw new Error(
          "The GS1 link contains an invalid lot or serial number.",
        );
      }
    }
  } else {
    value = value.replace(/[\s-]/g, "");
    if (format?.toLowerCase() === "upc_e") value = expandUPCE(value);
  }
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) {
    throw new Error(
      "Enter the 8, 12, 13, or 14 digits of a product barcode, or a GS1 Digital Link.",
    );
  }
  const sum = [...value.slice(0, -1)]
    .reverse()
    .reduce(
      (total, digit, index) => total + Number(digit) * (index % 2 ? 1 : 3),
      0,
    );
  if ((10 - (sum % 10)) % 10 !== Number(value.at(-1))) {
    throw new Error(
      "That barcode’s check digit doesn’t match. Check the numbers and try again.",
    );
  }
  return { ...result, gtin: value };
}
