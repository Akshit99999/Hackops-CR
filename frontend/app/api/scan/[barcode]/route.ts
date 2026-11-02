import { lookupProduct } from "@/lib/product-catalog";
import { parseBarcode } from "@/lib/barcodes";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ barcode: string }> },
) {
  const { barcode } = await context.params;
  try {
    parseBarcode(barcode);
  } catch (error) {
    return Response.json(
      { detail: error instanceof Error ? error.message : "Invalid barcode" },
      { status: 400 },
    );
  }
  try {
    const result = await lookupProduct(barcode, { signal: request.signal });
    return Response.json(result, {
      status: result.status === "unavailable" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      { detail: "Product lookup was interrupted. Please try again." },
      { status: 503 },
    );
  }
}
