import type { EvidenceDocument } from "./types";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("hackops-documents", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Document storage is unavailable in this browser."));
  });
}
export async function storeDocument(file: File): Promise<EvidenceDocument> {
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("Choose a document between 1 byte and 10 MB.");
  const bytes = await file.arrayBuffer();
  const head = new Uint8Array(bytes.slice(0, 8));
  const pdf = new TextDecoder().decode(head).startsWith("%PDF-");
  const png =
    head[0] === 137 && head[1] === 80 && head[2] === 78 && head[3] === 71;
  const jpeg = head[0] === 255 && head[1] === 216 && head[2] === 255;
  if (!pdf && !png && !jpeg)
    throw new Error("Choose a PDF, PNG, or JPEG document.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const document = {
    id: crypto.randomUUID(),
    name: file.name,
    size: file.size,
    sha256: Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
    date: new Date().toISOString().slice(0, 10),
  };
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("files", "readwrite");
    transaction
      .objectStore("files")
      .put(
        new Blob([bytes], {
          type: pdf ? "application/pdf" : png ? "image/png" : "image/jpeg",
        }),
        document.id,
      );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(
        new Error("Could not save this document. Browser storage may be full."),
      );
    transaction.onabort = () =>
      reject(new Error("Document storage was interrupted."));
  }).finally(() => db.close());
  return document;
}
export async function downloadDocument(document: EvidenceDocument) {
  const db = await openDatabase();
  const file = await new Promise<Blob>((resolve, reject) => {
    const request = db
      .transaction("files")
      .objectStore("files")
      .get(document.id);
    request.onsuccess = () =>
      request.result
        ? resolve(request.result)
        : reject(
            new Error(
              "This file is no longer stored in this browser. Upload it again.",
            ),
          );
    request.onerror = () => reject(new Error("Could not read this document."));
  }).finally(() => db.close());
  const url = URL.createObjectURL(file);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
