import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { generateContentFormPDF } from "./pdfForms";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// PDF form download endpoint
app.get("/api/forms/download/:type", async (req, res) => {
  try {
    const type = req.params.type;
    const validTypes = ["video", "written", "audio", "images", "social", "design", "games", "film", "other"];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: "Invalid content type" });
      return;
    }
    const labels: Record<string, string> = {
      video: "Video-Content", written: "Written-Works", audio: "Audio-Podcasts",
      images: "Images-Photography", social: "Social-Media", design: "Design-Illustration",
      games: "Games-Interactive", film: "Film-Cinema", other: "Other-Custom",
    };
    const pdf = await generateContentFormPDF(type as any);
    const filename = `Credtent-Content-Valuation-${labels[type]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err: any) {
    console.error("[PDF] Error:", err.message);
    res.status(500).json({ error: "Failed to generate PDF", detail: err.message });
  }
});

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
