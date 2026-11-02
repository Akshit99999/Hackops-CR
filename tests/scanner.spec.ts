import { test, expect, type Page } from "@playwright/test";
import { parseBarcode, expandUPCE } from "../frontend/lib/barcodes";
import { lookupProduct } from "../frontend/lib/product-catalog";
import type { ProductLookup } from "../frontend/lib/products";

const CODE = "0885909950805";
const productResult: ProductLookup = {
  barcode: CODE,
  status: "found",
  sources: [{ name: "UPCitemDB", status: "found" }],
  product: {
    barcode: CODE,
    name: "Apple iPhone 6, Space Gray, 64 GB",
    brand: "Apple",
    category: "Electronics > Mobile Phones",
    model: "MG5A2LL/A",
    quantity: "64 GB",
    description: "A product catalog description.",
    ingredients: "",
    allergens: [],
    nutriScore: null,
    image: null,
    source: { name: "UPCitemDB", url: `https://www.upcitemdb.com/upc/${CODE}` },
  },
};

// Standard EAN-13 modules generate an independent image fixture for the real decoder.
function barcodeBits(code = CODE) {
  const l = [
    "0001101",
    "0011001",
    "0010011",
    "0111101",
    "0100011",
    "0110001",
    "0101111",
    "0111011",
    "0110111",
    "0001011",
  ];
  const g = [
    "0100111",
    "0110011",
    "0011011",
    "0100001",
    "0011101",
    "0111001",
    "0000101",
    "0010001",
    "0001001",
    "0010111",
  ];
  const parity = [
    "LLLLLL",
    "LLGLGG",
    "LLGGLG",
    "LLGGGL",
    "LGLLGG",
    "LGGLLG",
    "LGGGLL",
    "LGLGLG",
    "LGLGGL",
    "LGGLGL",
  ][Number(code[0])];
  const left = [...code.slice(1, 7)]
    .map((digit, i) => (parity[i] === "L" ? l : g)[Number(digit)])
    .join("");
  const right = [...code.slice(7)]
    .map((digit) =>
      [...l[Number(digit)]].map((bit) => (bit === "1" ? "0" : "1")).join(""),
    )
    .join("");
  return `000000000000101${left}01010${right}101000000000000`;
}

async function barcodePhoto(page: Page, rotated = false) {
  const base64 = await page.evaluate(
    ({ bits, rotated }) => {
      const source = document.createElement("canvas");
      source.width = bits.length * 4;
      source.height = 220;
      const context = source.getContext("2d")!;
      context.fillStyle = "white";
      context.fillRect(0, 0, source.width, source.height);
      context.fillStyle = "black";
      [...bits].forEach((bit, i) => {
        if (bit === "1") context.fillRect(i * 4, 25, 4, 170);
      });
      if (!rotated) return source.toDataURL("image/png").split(",")[1];
      const canvas = document.createElement("canvas");
      canvas.width = source.height;
      canvas.height = source.width;
      const ctx = canvas.getContext("2d")!;
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(source, 0, 0);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { bits: barcodeBits(), rotated },
  );
  return {
    name: "barcode.png",
    mimeType: "image/png",
    buffer: Buffer.from(base64, "base64"),
  };
}

async function mockCatalog(page: Page) {
  await page.route("**/api/scan/*", (route) =>
    route.fulfill({ json: productResult }),
  );
}

test("barcode parsing verifies checksums and preserves GS1 identifiers", () => {
  expect(parseBarcode("0885 9099 50805").gtin).toBe(CODE);
  expect(expandUPCE("04252614")).toBe("042100005264");
  expect(parseBarcode("04252614", "upc_e").gtin).toBe("042100005264");
  expect(
    parseBarcode("https://id.gs1.org/01/00885909950805/10/LOT-A/21/SN%2012"),
  ).toEqual({ gtin: "00885909950805", lot: "LOT-A", serial: "SN 12" });
  expect(() => parseBarcode("0885909950806")).toThrow(/check digit/);
  expect(() => parseBarcode("https://example.com/ordinary-page")).toThrow(
    /not a product code/,
  );
});

test("catalog fallback finds general products when Open Food Facts is unavailable", async () => {
  const urls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("openfoodfacts.org"))
      throw new TypeError("Network unavailable");
    return Response.json({
      code: "OK",
      items: [
        {
          ean: CODE,
          title: "Apple iPhone 6",
          brand: "Apple",
          model: "MG5A2LL/A",
          category: "Electronics",
          images: ["http://unsafe.example/test.jpg"],
        },
      ],
    });
  }) as typeof fetch;
  const result = await lookupProduct(CODE, { fetcher });
  expect(result.status).toBe("found");
  expect(result.product?.name).toBe("Apple iPhone 6");
  expect(result.product?.image).toBeNull();
  expect(result.product?.source.name).toBe("UPCitemDB");
  expect(result.sources[0].status).toBe("unavailable");
  expect(urls).toHaveLength(2);
  expect(urls[1]).toContain(`upc=${CODE}`);
});

test("catalogs distinguish no listing, rate limits, and unsafe redirects", async () => {
  const absent = await lookupProduct(CODE, {
    fetcher: (async (input) =>
      String(input).includes("openfoodfacts.org")
        ? Response.json({ status: 0 }, { status: 404 })
        : Response.json({ code: "OK", items: [] })) as typeof fetch,
  });
  expect(absent.status).toBe("not_found");
  const limited = await lookupProduct(CODE, {
    fetcher: (async () => new Response(null, { status: 429 })) as typeof fetch,
  });
  expect(limited.status).toBe("unavailable");
  expect(
    limited.sources.every((source) => source.status === "rate_limited"),
  ).toBe(true);
  const visited: string[] = [];
  await lookupProduct(CODE, {
    fetcher: (async (input) => {
      visited.push(String(input));
      return String(input).includes("openfoodfacts.org")
        ? new Response(null, {
            status: 302,
            headers: { location: "https://example.com/private" },
          })
        : Response.json({ code: "OK", items: [] });
    }) as typeof fetch,
  });
  expect(visited.some((url) => url.includes("example.com"))).toBe(false);
});

test("manual lookup saves catalog details and GS1 metadata into a persistent passport", async ({
  page,
}) => {
  await mockCatalog(page);
  await page.goto("/scan");
  await page
    .getByLabel("Barcode or GS1 Digital Link")
    .fill("https://id.gs1.org/01/00885909950805/10/BATCH-A/21/DEVICE-123");
  await page
    .getByRole("button", { name: "Look up product", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: productResult.product!.name,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("BATCH-A", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save to warranty vault" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Product name")).toHaveValue(
    productResult.product!.name,
  );
  await expect(dialog.getByLabel("Brand", { exact: true })).toHaveValue(
    "Apple",
  );
  await expect(dialog.getByLabel("Model number (optional)")).toHaveValue(
    "MG5A2LL/A",
  );
  await expect(dialog.getByLabel("Serial number (optional)")).toHaveValue(
    "DEVICE-123",
  );
  await dialog.getByLabel("Purchased from").fill("Test retailer");
  await dialog.getByLabel("Purchase price (USD)").fill("120.50");
  await dialog.getByRole("button", { name: "Add to my vault" }).click();
  await page.goto("/warranty-vault");
  await page
    .getByRole("button", {
      name: `Open passport for ${productResult.product!.name}`,
    })
    .click();
  await expect(
    page.getByRole("dialog").getByText("00885909950805", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("BATCH-A", { exact: true }),
  ).toBeVisible();
});

test("uploaded barcode photo decodes without native BarcodeDetector, including rotation", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "BarcodeDetector", {
      configurable: true,
      value: undefined,
    });
  });
  await mockCatalog(page);
  await page.goto("/scan");
  await page
    .getByLabel("Upload a barcode photo")
    .setInputFiles(await barcodePhoto(page, true));
  await expect(
    page.getByRole("heading", {
      name: productResult.product!.name,
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Barcode or GS1 Digital Link")).toHaveValue(
    /^0?885909950805$/,
  );
  await page.screenshot({
    path: "test-results/scanner-live-product.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("ZXing reads actual camera frames without native detection and releases the stream", async ({
  page,
}) => {
  await page.addInitScript(
    ({ bits }) => {
      Object.defineProperty(window, "BarcodeDetector", {
        configurable: true,
        value: undefined,
      });
      (window as any).__stoppedTracks = 0;
      Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
        configurable: true,
        value: async () => {
          const canvas = document.createElement("canvas");
          canvas.width = bits.length * 4;
          canvas.height = 220;
          const context = canvas.getContext("2d")!;
          context.fillStyle = "white";
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.fillStyle = "black";
          [...bits].forEach((bit, i) => {
            if (bit === "1") context.fillRect(i * 4, 25, 4, 170);
          });
          const stream = canvas.captureStream(10);
          for (const track of stream.getTracks()) {
            const original = track.stop.bind(track);
            track.stop = () => {
              (window as any).__stoppedTracks++;
              original();
            };
          }
          return stream;
        },
      });
    },
    { bits: barcodeBits() },
  );
  await mockCatalog(page);
  await page.goto("/scan");
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: productResult.product!.name,
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("button", { name: "Open camera", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => (window as any).__stoppedTracks),
  ).toBeGreaterThan(0);
});

test("permission failures explain recovery and lookup cancellation ignores old results", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        throw new DOMException("Denied", "NotAllowedError");
      },
    });
  });
  await page.route("**/api/scan/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({ json: productResult }).catch(() => {});
  });
  await page.goto("/scan");
  await page.getByRole("button", { name: "Open camera", exact: true }).click();
  await expect(page.locator(".form-error")).toContainText(
    "permission was denied",
  );
  await page.getByLabel("Barcode or GS1 Digital Link").fill(CODE);
  await page
    .getByRole("button", { name: "Look up product", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cancel lookup", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little less guesswork." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: productResult.product!.name,
      exact: true,
    }),
  ).toHaveCount(0);
});
