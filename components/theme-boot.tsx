"use client";

import { useEffect } from "react";
import { api } from "@/lib/client";
import type { AppSettings } from "@/lib/types";

export function ThemeBoot() {
  useEffect(() => {
    api<AppSettings>("/api/settings")
      .then((s) => {
        document.documentElement.dataset.theme = s.theme || "paper";
      })
      .catch(() => {});
  }, []);
  return null;
}
