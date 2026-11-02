export interface CatalogSource {
  name: string;
  status: "found" | "not_found" | "unavailable" | "rate_limited";
}

export interface ScannedProduct {
  barcode: string;
  name: string;
  brand: string;
  category: string;
  model: string;
  quantity: string;
  description: string;
  ingredients: string;
  allergens: string[];
  nutriScore: string | null;
  image: string | null;
  source: { name: string; url: string; license?: string };
}

export interface ProductLookup {
  barcode: string;
  status: "found" | "not_found" | "unavailable";
  product: ScannedProduct | null;
  sources: CatalogSource[];
}

export interface RecallLookup {
  recalls: {
    source?: string;
    title?: string;
    product?: string;
    reason?: string;
    recall_number?: string;
    source_url?: string;
  }[];
  sources: { cpsc?: { status?: string }; openfda?: { status?: string } };
  retrieved_at?: string;
  disclaimer?: string;
}
