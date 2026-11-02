export interface EvidenceDocument {
  id: string;
  name: string;
  size: number;
  sha256: string;
  date: string;
}

export interface DisputeCase {
  id: string;
  consumerName: string;
  merchant: string;
  product: string;
  purchaseDate: string;
  defectDate: string;
  claimAmount: number;
  narrative: string;
  status: "Draft notice" | "Awaiting response" | "Resolved";
  createdDate: string;
  deadline: string | null;
  documents: EvidenceDocument[];
  sample?: boolean;
}

export interface WarrantyItem {
  id: string;
  name: string;
  brand: string;
  category: "Audio" | "Computing" | "Home" | "Other";
  modelNumber: string;
  serialNumber: string;
  seller: string;
  purchaseDate: string;
  purchasePrice: number;
  warrantyDurationMonths: number;
  expiryDate: string;
  documents: EvidenceDocument[];
  sample?: boolean;
}

export interface Activity {
  id: string;
  title: string;
  detail: string;
  date: string;
  kind: "case" | "warranty" | "audit";
}

export interface Workspace {
  version: 1;
  cases: DisputeCase[];
  warranties: WarrantyItem[];
  activities: Activity[];
}

export interface ClauseFlag {
  category: string;
  severity: "High" | "Medium";
  axis: number;
  sentenceId: string;
  quote: string;
  explanation: string;
}

export interface ContractAudit {
  id: string;
  sentences: { id: string; text: string }[];
  flags: ClauseFlag[];
  score: number;
  axes: number[];
}
