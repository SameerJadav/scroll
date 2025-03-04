import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { compose, json, logger } from "./middleware.js";
import { getStaticRoutes } from "./utils.js";

const publicDir = path.join(process.cwd(), "public");
const staticRoutes = await getStaticRoutes(publicDir, publicDir);

/** @type {import("./types.js").ExtendedRequestListner} */
async function handler(req, res) {
  if (!req.url) return;

  if (staticRoutes.has(req.url)) {
    const route = staticRoutes.get(req.url);
    if (route) {
      res.writeHead(200, { "Content-Type": route.contentType });
      res.end(await fs.readFile(route.filePath));
      return;
    }
  }

  if (req.url === "/api/auth/signup") {
    console.log(req.body);
    return;
  }
}

const server = http.createServer();

server.on("request", compose([logger, json], handler));

let port = process.env["PORT"] ? parseInt(process.env["PORT"]) : 300;

server.on(
  "error",
  /** @param {NodeJS.ErrnoException} error */
  (error) => {
    if (error.code === "EADDRINUSE") {
      port++;
      console.error(`Port in use, trying ${port}`);
      server.listen(port);
    } else {
      console.error("Server error:", error);
    }
  },
);

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
