"use client";

import { useEffect, useState } from "react";

export default function ProgressPage() {
  const [html, setHtml] = useState("Loading build log…");
  useEffect(() => {
    fetch("/progress-static/index.html")
      .then((r) => r.text())
      .then(setHtml)
      .catch(() => setHtml("Progress surface is also at port 4173."));
  }, []);
  return (
    <iframe
      title="Build progress"
      className="h-[100dvh] w-full border-0"
      srcDoc={html}
    />
  );
}
