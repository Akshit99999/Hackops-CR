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

const KEY = "hackops-workspace-v1";
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
    try {
      const stored = localStorage.getItem(KEY);
      const parsed = stored ? JSON.parse(stored) : sampleWorkspace();
      if (
        parsed.version !== 1 ||
        !Array.isArray(parsed.cases) ||
        !Array.isArray(parsed.warranties) ||
        !Array.isArray(parsed.activities)
      )
        throw new Error();
      setData(parsed);
    } catch {
      setData(sampleWorkspace());
      notify(
        "Saved workspace could not be read. A fresh demo has been loaded.",
      );
    }
    setReady(true);
    return () => {
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
  const addCase = (item: DisputeCase) =>
    setData((prev) => ({
      ...prev,
      cases: [item, ...prev.cases],
      activities: [
        activity("New case drafted", `${item.product} · ${item.id}`, "case"),
        ...prev.activities,
      ].slice(0, 30),
    }));
  const updateCase = (id: string, action: "sent" | "resolved") =>
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
  const addWarranty = (item: WarrantyItem) =>
    setData((prev) => ({
      ...prev,
      warranties: [item, ...prev.warranties],
      activities: [
        activity("A new purchase protected", item.name, "warranty"),
        ...prev.activities,
      ].slice(0, 30),
    }));
  const updateWarranty = (item: WarrantyItem) =>
    setData((prev) => ({
      ...prev,
      warranties: prev.warranties.map((value) =>
        value.id === item.id ? item : value,
      ),
    }));
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
