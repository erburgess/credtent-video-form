import express from "express";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Diagnostic endpoint to verify function is alive
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Lazy-load all server modules to capture import errors at request time
let initialized = false;
let initError: Error | null = null;
let appRouter: any;
let createContext: any;
let generateContentFormPDF: any;

async function ensureInitialized() {
  if (initialized) return;
  if (initError) throw initError;
  try {
    const routers = await import("../server/routers.js");
    appRouter = routers.appRouter;

    const context = await import("../server/_core/context.js");
    createContext = context.createContext;

    const pdfForms = await import("../server/pdfForms.js");
    generateContentFormPDF = pdfForms.generateContentFormPDF;

    initialized = true;
  } catch (err: any) {
    initError = err;
    console.error("[API INIT ERROR]", err.message, err.stack);
    throw err;
  }
}

// PDF form download endpoint
app.get("/api/forms/download/:type", async (req, res) => {
  try {
    await ensureInitialized();
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
    const pdf = await generateContentFormPDF(type);
    const filename = `Credtent-Content-Valuation-${labels[type]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err: any) {
    console.error("[PDF] Error:", err.message);
    res.status(500).json({ error: "Failed to generate PDF", detail: err.message });
  }
});

// tRPC API - lazy loaded
app.all("/api/trpc/*", async (req, res) => {
  try {
    await ensureInitialized();
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const middleware = createExpressMiddleware({
      router: appRouter,
      createContext,
    });
    middleware(req, res, () => {});
  } catch (err: any) {
    console.error("[tRPC] Error:", err.message, err.stack);
    res.status(500).json({ error: "Server initialization failed", detail: err.message });
  }
});

export default app;
