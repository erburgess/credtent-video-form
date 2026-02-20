import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { generateContentFormPDF } from "../pdfForms";
import type { ContentTypeKey } from "../pdfForms";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // PDF form download endpoint
  app.get("/api/forms/download/:type", async (req, res) => {
    try {
      const type = req.params.type as ContentTypeKey;
      const validTypes: ContentTypeKey[] = ["video", "written", "audio", "images", "social", "design", "games", "film", "other"];
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
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
