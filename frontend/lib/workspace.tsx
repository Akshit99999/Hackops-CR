"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import type { Workspace, DisputeCase, WarrantyItem, Activity } from "./types";
import { sampleWorkspace } from "./sample-data";
import { today, offsetDate } from "./utils";
import { backendConfigured, backendRequest, getBackendToken, resetBackendWorkspace, uploadBackendEvidence } from "./backend";
import { loadDocumentBlob } from "./documents";

const KEY = "hackops-workspace-v1";
let backendBootstrap: Promise<{ snapshot: Record<string, any>; skippedDocuments: number }> | null = null;
const empty: Workspace = {
  version: 1,
  cases: [],
  warranties: [],
  activities: [],
};
interface WorkspaceContext {
  data: Workspace;
  ready: boolean;
  message: string;
  notify: (text: string) => void;
  addCase: (item: DisputeCase) => void;
  updateCase: (id: string, action: "sent" | "resolved") => void;
  addWarranty: (item: WarrantyItem) => void;
  updateWarranty: (item: WarrantyItem) => void;
  addActivity: (title: string, detail: string, kind: Activity["kind"]) => void;
  reset: (samples: boolean) => void;
}
const Context = createContext<WorkspaceContext | null>(null);

function mapRemoteDocument(document: Record<string, unknown>) {
  return {
    id: String(document.id),
    name: String(document.name),
    size: Number(document.size),
    sha256: String(document.sha256),
    date: String(document.date),
    backendUrl: String(document.download_url || ""),
  };
}

function mapRemoteWorkspace(snapshot: Record<string, any>): Workspace {
  return {
    version: 1,
    cases: (snapshot.cases || []).map((item: Record<string, any>) => ({
      id: item.id,
      consumerName: item.consumer_name,
      merchant: item.merchant,
      product: item.product,
      purchaseDate: item.purchase_date,
      defectDate: item.defect_date,
      claimAmount: item.claim_amount,
      narrative: item.narrative,
      status: item.status,
      createdDate: item.created_date,
      deadline: item.deadline,
      documents: (item.documents || []).map(mapRemoteDocument),
      noticeMarkdown: item.notice_markdown,
      merkleRoot: item.merkle_root,
      sample: item.sample,
    })),
    warranties: (snapshot.warranties || []).map((item: Record<string, any>) => ({
      id: item.id,
      name: item.name,
      brand: item.brand,
      category: item.category,
      modelNumber: item.model_number,
      serialNumber: item.serial_number,
      seller: item.seller,
      purchaseDate: item.purchase_date,
      purchasePrice: item.purchase_price,
      warrantyDurationMonths: item.warranty_duration_months,
      expiryDate: item.expiry_date,
      documents: (item.documents || []).map(mapRemoteDocument),
      sample: item.sample,
    })),
    activities: (snapshot.activities || []).map((item: Record<string, any>) => ({
      id: item.id,
      title: item.title,
      detail: item.detail,
      date: item.date,
      kind: item.kind,
    })),
  };
}

async function uploadLocalFile(path: string, document: Workspace["warranties"][number]["documents"][number], id?: string) {
  const blob = await loadDocumentBlob(document.id);
  if (!blob) return false;
  const type = blob.type || (document.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : document.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
  const file = new File([blob], document.name, { type });
  await uploadBackendEvidence(path, file, id || document.id);
  return true;
}

async function migrateLocalRecords(local: Workspace, remote: Record<string, any>) {
  const remoteWarranties = new Map<string, Record<string, any>>((remote.warranties || []).map((item: Record<string, any>) => [item.id, item]));
  const remoteCases = new Map<string, Record<string, any>>((remote.cases || []).map((item: Record<string, any>) => [item.id, item]));
  let skippedDocuments = 0;
  for (const item of local.warranties.filter((value) => !value.sample)) {
    const remoteItem = remoteWarranties.get(item.id);
    if (!remoteItem) {
      await backendRequest("/warranty/items", {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          name: item.name,
          brand: item.brand,
          category: item.category,
          model_number: item.modelNumber,
          serial_number: item.serialNumber,
          seller: item.seller,
          purchase_date: item.purchaseDate,
          purchase_price: item.purchasePrice,
          warranty_duration_months: item.warrantyDurationMonths,
          expiry_date: item.expiryDate,
        }),
      });
    }
    const existingHashes = new Set((remoteItem?.documents || []).map((document: Record<string, any>) => document.sha256));
    for (const document of item.documents) {
      if (existingHashes.has(document.sha256)) continue;
      try {
        if (!await uploadLocalFile(`/warranty/items/${encodeURIComponent(item.id)}/documents`, document)) skippedDocuments++;
        else existingHashes.add(document.sha256);
      } catch {
        skippedDocuments++;
      }
    }
  }
  for (const item of local.cases.filter((value) => !value.sample)) {
    const remoteItem = remoteCases.get(item.id);
    if (!remoteItem) {
      await backendRequest("/cases/intake", {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          consumer_name: item.consumerName,
          merchant: item.merchant,
          product: item.product,
          purchase_date: item.purchaseDate,
          defect_date: item.defectDate,
          claim_amount: item.claimAmount,
          narrative: item.narrative,
        }),
      });
    }
    const existingHashes = new Set((remoteItem?.documents || []).map((document: Record<string, any>) => document.sha256));
    for (const document of item.documents) {
      if (existingHashes.has(document.sha256)) continue;
      try {
        // A local case may share a document ID with its vault item; use a fresh ID for this copy.
        if (!await uploadLocalFile(`/cases/${encodeURIComponent(item.id)}/documents`, document, crypto.randomUUID())) skippedDocuments++;
        else existingHashes.add(document.sha256);
      } catch {
        skippedDocuments++;
      }
    }
    if (item.status === "Awaiting response" && remoteItem?.status !== "Awaiting response")
      await backendRequest(`/cases/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: item.status, notice_sent_date: item.deadline ? new Date(Date.parse(item.deadline) - 15 * 86400000).toISOString().slice(0, 10) : item.createdDate, cure_days: item.deadline ? 15 : null }),
      });
    else if (item.status === "Resolved" && remoteItem?.status !== "Resolved")
      await backendRequest(`/cases/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Resolved" }),
      });
  }
  return skippedDocuments;
}

function initializeBackendWorkspace(local: Workspace) {
  if (!backendBootstrap) {
    backendBootstrap = (async () => {
      await getBackendToken();
      let snapshot = await backendRequest<Record<string, any>>("/workspace/snapshot");
      const hasLocalRecords = local.cases.some((item) => !item.sample) || local.warranties.some((item) => !item.sample);
      const skippedDocuments = hasLocalRecords ? await migrateLocalRecords(local, snapshot) : 0;
      if (hasLocalRecords) snapshot = await backendRequest<Record<string, any>>("/workspace/snapshot");
      return { snapshot, skippedDocuments };
    })().catch((error) => {
      backendBootstrap = null;
      throw error;
    });
  }
  return backendBootstrap;
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Workspace>(empty);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(""), 5000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      let local: Workspace;
      try {
        const stored = localStorage.getItem(KEY);
        const parsed = stored ? JSON.parse(stored) : sampleWorkspace();
        if (parsed.version !== 1 || !Array.isArray(parsed.cases) || !Array.isArray(parsed.warranties) || !Array.isArray(parsed.activities))
          throw new Error();
        local = parsed;
      } catch {
        local = sampleWorkspace();
        notify("Saved workspace could not be read. A fresh demo has been loaded.");
      }
      if (backendConfigured()) {
        try {
          const { snapshot, skippedDocuments } = await initializeBackendWorkspace(local);
          if (skippedDocuments)
            notify(`${skippedDocuments} local document(s) could not be copied to the backend; the browser copy remains available.`);
          const remote = mapRemoteWorkspace(snapshot);
          const samples = {
            cases: local.cases.filter((item: DisputeCase) => item.sample),
            warranties: local.warranties.filter((item: WarrantyItem) => item.sample),
          };
          local = {
            ...remote,
            cases: [...samples.cases, ...remote.cases],
            warranties: [...samples.warranties, ...remote.warranties],
          };
        } catch {
          notify("Backend is unavailable. This browser will keep using its saved workspace until it reconnects.");
        }
      }
      if (!cancelled) {
        setData(local);
        setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [notify]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      notify(
        "Browser storage is full or unavailable. Changes will last for this session only.",
      );
    }
  }, [data, ready, notify]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== KEY || !event.newValue) return;
      try {
        const next = JSON.parse(event.newValue);
        if (
          next.version === 1 &&
          Array.isArray(next.cases) &&
          Array.isArray(next.warranties) &&
          Array.isArray(next.activities)
        )
          setData(next);
      } catch {
        /* Keep current workspace if a different tab writes malformed data. */
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const activity = (
    title: string,
    detail: string,
    kind: Activity["kind"],
  ): Activity => ({
    id: crypto.randomUUID(),
    title,
    detail,
    kind,
    date: today(),
  });
  const addCase = (item: DisputeCase) => {
    setData((prev) => ({
      ...prev,
      cases: [item, ...prev.cases],
      activities: [
        activity("New case drafted", `${item.product} · ${item.id}`, "case"),
        ...prev.activities,
      ].slice(0, 30),
    }));
    if (backendConfigured() && !item.sample)
      void backendRequest<Record<string, any>>("/cases/intake", {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          consumer_name: item.consumerName,
          merchant: item.merchant,
          product: item.product,
          purchase_date: item.purchaseDate,
          defect_date: item.defectDate,
          claim_amount: item.claimAmount,
          narrative: item.narrative,
          evidence_document_ids: item.documents.map((document) => document.id),
        }),
      }).then((saved) => {
        setData((prev) => ({
          ...prev,
          cases: prev.cases.map((value) => value.id === item.id
            ? { ...value, noticeMarkdown: saved.notice_markdown, merkleRoot: saved.merkle_root }
            : value),
        }));
      }).catch(() => notify("Case kept in this browser, but it could not be saved to the backend."));
  };
  const updateCase = (id: string, action: "sent" | "resolved") => {
    setData((prev) => ({
      ...prev,
      cases: prev.cases.map((item) =>
        item.id !== id
          ? item
          : {
              ...item,
              status: action === "sent" ? "Awaiting response" : "Resolved",
              deadline: action === "sent" ? offsetDate(15) : null,
            },
      ),
      activities: [
        activity(
          action === "sent"
            ? "Notice recorded as sent"
            : "Case marked resolved",
          id,
          "case",
        ),
        ...prev.activities,
      ].slice(0, 30),
    }));
    const item = data.cases.find((value) => value.id === id);
    if (backendConfigured() && item && !item.sample)
      void backendRequest(`/cases/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(action === "sent"
          ? { status: "Awaiting response", notice_sent_date: today(), cure_days: 15 }
          : { status: "Resolved" }),
      }).catch(() => notify("Status kept in this browser, but it could not be saved to the backend."));
  };
  const addWarranty = (item: WarrantyItem) => {
    setData((prev) => ({
      ...prev,
      warranties: [item, ...prev.warranties],
      activities: [
        activity("A new purchase protected", item.name, "warranty"),
        ...prev.activities,
      ].slice(0, 30),
    }));
    if (backendConfigured() && !item.sample)
      void backendRequest("/warranty/items", {
        method: "POST",
        body: JSON.stringify({
          id: item.id,
          name: item.name,
          brand: item.brand,
          category: item.category,
          model_number: item.modelNumber,
          serial_number: item.serialNumber,
          seller: item.seller,
          purchase_date: item.purchaseDate,
          purchase_price: item.purchasePrice,
          warranty_duration_months: item.warrantyDurationMonths,
          expiry_date: item.expiryDate,
        }),
      }).catch(() => notify("Purchase kept in this browser, but it could not be saved to the backend."));
  };
  const updateWarranty = (item: WarrantyItem) => {
    setData((prev) => ({
      ...prev,
      warranties: prev.warranties.map((value) =>
        value.id === item.id ? item : value,
      ),
    }));
    const existing = data.warranties.find((value) => value.id === item.id);
    if (backendConfigured() && existing && !item.sample)
      void backendRequest(`/warranty/items/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: item.name,
          brand: item.brand,
          category: item.category,
          model_number: item.modelNumber,
          serial_number: item.serialNumber,
          seller: item.seller,
          purchase_date: item.purchaseDate,
          purchase_price: item.purchasePrice,
          warranty_duration_months: item.warrantyDurationMonths,
          expiry_date: item.expiryDate,
        }),
      }).catch(() => notify("Purchase details kept in this browser, but they could not be saved to the backend."));
  };
  const addActivity = (title: string, detail: string, kind: Activity["kind"]) =>
    setData((prev) => ({
      ...prev,
      activities: [activity(title, detail, kind), ...prev.activities].slice(
        0,
        30,
      ),
    }));
  const reset = (samples: boolean) => {
    setData(samples ? sampleWorkspace() : empty);
    notify(
      samples
        ? "Sample workspace restored."
        : "A fresh workspace, ready for your purchases.",
    );
    if (backendConfigured())
      void resetBackendWorkspace().catch(() => notify("Browser workspace reset. Backend records could not be cleared while offline."));
  };
  return (
    <Context.Provider
      value={{
        data,
        ready,
        message,
        notify,
        addCase,
        updateCase,
        addWarranty,
        updateWarranty,
        addActivity,
        reset,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(Context);
  if (!context) throw new Error("Workspace provider is missing");
  return context;
}
