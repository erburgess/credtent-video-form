import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { generateContentFormPDF } from "../server/pdfForms";
import type { ContentTypeKey } from "../server/pdfForms";

const app = express();

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// OAuth callback
registerOAuthRoutes(app);

// PDF form download endpoint
app.get("/api/forms/download/:type", async (req, res) => {
  try {
    const type = req.params.type as ContentTypeKey;
    const validTypes: ContentTypeKey[] = [
      "video", "written", "audio", "images", "social",
      "design", "games", "film", "other",
    ];
    if (!validTypes.includes(type)) {
      res.status(400).json({ error: "Invalid content type" });
      return;
    }
    const pdf = await generateContentFormPDF(type);
    const labels: Record<ContentTypeKey, string> = {
      video: "Video-Content",
      written: "Written-Works",
      audio: "Audio-Podcasts",
      images: "Images-Photography",
      social: "Social-Media",
      design: "Design-Illustration",
      games: "Games-Interactive",
      film: "Film-Cinema",
      other: "Other-Custom",
    };
    const filename = `Credtent-Content-Valuation-${labels[type]}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdf);
  } catch (err) {
    console.error("[PDF] Generation error:", err);
    res.status(500).json({ error: "Failed to generate PDF" });
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
