import { parseBarcode } from "./barcodes";
import type { CatalogSource, ProductLookup, ScannedProduct } from "./products";

const HEADERS = {
  "User-Agent":
    "Hackops-CR/0.1 (https://github.com/vishalbudhathoki/Hackops-CR)",
  Accept: "application/json",
};
const CATALOGS: Record<string, string> = {
  "world.openfoodfacts.org": "Open Food Facts",
  "world.openproductsfacts.org": "Open Products Facts",
  "world.openbeautyfacts.org": "Open Beauty Facts",
  "world.openpetfoodfacts.org": "Open Pet Food Facts",
};
const IMAGE_HOSTS = new Set([
  "images.openfoodfacts.org",
  "images.openproductsfacts.org",
  "images.openbeautyfacts.org",
  "images.openpetfoodfacts.org",
  "i5.walmartimages.com",
  "c1.neweggimages.com",
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "target.scene7.com",
  "pics.walgreens.com",
  "img.bbystatic.com",
]);
type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : {};
const text = (value: unknown, max = 2000): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const sameCode = (a: string, b: string) =>
  /^\d{8,14}$/.test(a) && a.padStart(14, "0") === b.padStart(14, "0");

function safeImage(value: unknown): string | null {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      IMAGE_HOSTS.has(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

async function readCatalog(
  url: URL,
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetcher(url, {
    headers: HEADERS,
    redirect: "manual",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(7000)])
      : AbortSignal.timeout(7000),
    next: { revalidate: 3600 },
  });
  return response;
}

/** All upstream URLs are fixed catalogs; QR/link input is never fetched. */
export async function lookupProduct(
  raw: string,
  options: { fetcher?: typeof fetch; signal?: AbortSignal } = {},
): Promise<ProductLookup> {
  const { gtin } = parseBarcode(raw);
  const fetcher = options.fetcher || fetch;
  const sources: CatalogSource[] = [];
  const fields =
    "code,product_name,product_name_en,generic_name,brands,quantity,categories,ingredients_text,allergens_tags,nutriscore_grade,image_front_small_url,image_front_url";
  let url = new URL(
    `https://world.openfoodfacts.org/api/v2/product/${gtin}.json`,
  );
  url.searchParams.set("fields", fields);
  url.searchParams.set("product_type", "all");
  url.searchParams.set("lc", "en");
  let sourceName = CATALOGS[url.hostname];
  try {
    for (let redirects = 0; redirects < 4; redirects++) {
      sourceName = CATALOGS[url.hostname];
      const response = await readCatalog(url, fetcher, options.signal);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Missing catalog redirect");
        const redirect = new URL(location, url);
        if (
          redirect.protocol !== "https:" ||
          !CATALOGS[redirect.hostname] ||
          redirect.port ||
          redirect.username ||
          redirect.password ||
          redirect.pathname !== url.pathname
        )
          throw new Error("Invalid catalog redirect");
        url = redirect;
        continue;
      }
      if (response.status === 429) {
        sources.push({ name: sourceName, status: "rate_limited" });
        break;
      }
      if (response.status !== 404 && !response.ok)
        throw new Error("Catalog unavailable");
      const payload = object(await response.json());
      if (response.status === 404 || payload.status === 0) {
        sources.push({ name: sourceName, status: "not_found" });
        break;
      }
      if (payload.status !== 1) throw new Error("Invalid catalog response");
      const data = object(payload.product);
      const code = text(data.code || payload.code);
      if (!sameCode(code, gtin))
        throw new Error("Catalog returned a different barcode");
      const name = text(
        data.product_name_en || data.product_name || data.generic_name,
        200,
      );
      if (!name) {
        sources.push({ name: sourceName, status: "not_found" });
        break;
      }
      const product: ScannedProduct = {
        barcode: gtin,
        name,
        brand: text(data.brands, 100),
        category: text(data.categories, 500),
        model: "",
        quantity: text(data.quantity, 100),
        description: "",
        ingredients: text(data.ingredients_text, 5000),
        allergens: Array.isArray(data.allergens_tags)
          ? data.allergens_tags
              .filter((tag): tag is string => typeof tag === "string")
              .slice(0, 30)
              .map((tag) =>
                tag
                  .replace(/^[a-z]{2}:/, "")
                  .replace(/-/g, " ")
                  .slice(0, 100),
              )
          : [],
        nutriScore: /^[a-e]$/i.test(text(data.nutriscore_grade))
          ? text(data.nutriscore_grade).toUpperCase()
          : null,
        image: safeImage(data.image_front_small_url || data.image_front_url),
        source: {
          name: sourceName,
          url: `https://${url.hostname}/product/${code}`,
          license: "ODbL",
        },
      };
      return {
        barcode: gtin,
        status: "found",
        product,
        sources: [...sources, { name: sourceName, status: "found" }],
      };
    }
    if (!sources.length) throw new Error("Too many catalog redirects");
  } catch {
    if (options.signal?.aborted) throw options.signal.reason;
    sources.push({ name: sourceName, status: "unavailable" });
  }

  // The free, keyless endpoint provides non-food coverage and a second catalog
  // when OFF is unavailable. Its IP quota is shared; successful fetches are cached.
  const fallbackCode =
    gtin.length === 14 && gtin[0] === "0" ? gtin.slice(1) : gtin;
  if (fallbackCode.length <= 13) {
    try {
      const fallback = new URL("https://api.upcitemdb.com/prod/trial/lookup");
      fallback.searchParams.set("upc", fallbackCode);
      const response = await readCatalog(fallback, fetcher, options.signal);
      if (response.status === 429)
        sources.push({ name: "UPCitemDB", status: "rate_limited" });
      else {
        if (response.status !== 404 && !response.ok)
          throw new Error("Catalog unavailable");
        const payload = object(await response.json());
        if (
          response.status === 404 ||
          (payload.code === "OK" &&
            Array.isArray(payload.items) &&
            !payload.items.length)
        )
          sources.push({ name: "UPCitemDB", status: "not_found" });
        else {
          if (payload.code !== "OK" || !Array.isArray(payload.items))
            throw new Error("Invalid catalog response");
          const item = payload.items
            .map(object)
            .find((data) => sameCode(text(data.ean || data.upc), gtin));
          if (!item || !text(item.title))
            throw new Error("Catalog returned a different barcode");
          const product: ScannedProduct = {
            barcode: gtin,
            name: text(item.title, 200),
            brand: text(item.brand, 100),
            category: text(item.category, 500),
            model: text(item.model, 100),
            quantity: text(item.size || item.weight, 100),
            description: text(item.description),
            ingredients: "",
            allergens: [],
            nutriScore: null,
            image: Array.isArray(item.images)
              ? item.images.map(safeImage).find(Boolean) || null
              : null,
            source: {
              name: "UPCitemDB",
              url: `https://www.upcitemdb.com/upc/${fallbackCode}`,
            },
          };
          return {
            barcode: gtin,
            status: "found",
            product,
            sources: [...sources, { name: "UPCitemDB", status: "found" }],
          };
        }
      }
    } catch {
      if (options.signal?.aborted) throw options.signal.reason;
      sources.push({ name: "UPCitemDB", status: "unavailable" });
    }
  }
  return {
    barcode: gtin,
    status: sources.some((source) => source.status === "not_found")
      ? "not_found"
      : "unavailable",
    product: null,
    sources,
  };
}
