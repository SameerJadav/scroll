import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { logger } from "./middleware.js";

/**
 * @typedef {Object} RouteInfo
 * @property {string} filePath
 * @property {string} contentType
 */

/**
 * @param {string} srcDir
 * @param {string} baseDir
 * @returns {Promise<Map<string,RouteInfo>>}
 */
async function getStaticRoutes(srcDir, baseDir) {
  /** @type {Map<string,RouteInfo>} */
  let routes = new Map();
  const entries = await fs.readdir(srcDir);
  for (const entry of entries) {
    const fullpath = path.join(srcDir, entry);
    const stats = await fs.stat(fullpath);
    if (stats.isDirectory()) {
      const subRoutes = await getStaticRoutes(fullpath, baseDir);
      for (const [key, value] of subRoutes) {
        routes.set(key, value);
      }
    } else {
      let route =
        "/" + path.relative(baseDir, fullpath).split(path.sep).join("/");
      const extention = path.extname(entry);
      switch (extention) {
        case ".html":
          route = route.slice(0, -extention.length);
          if (route.endsWith("index")) {
            route = route.slice(0, -"index".length);
            if (route.endsWith("/") && route !== "/") {
              route = route.slice(0, -1);
            }
          }
          routes.set(route, { filePath: fullpath, contentType: "text/html" });
          break;
        case ".css":
          routes.set(route, { filePath: fullpath, contentType: "text/css" });
          break;
        case ".js":
          routes.set(route, {
            filePath: fullpath,
            contentType: "application/javascript",
          });
          break;
        default:
      }
    }
  }
  return routes;
}

const publicDir = path.join(process.cwd(), "public");
const staticRoutes = await getStaticRoutes(publicDir, publicDir);

const server = http.createServer();

server.on("request", (req, res) => {
  logger(req, res, async () => {
    if (req.url && staticRoutes.has(req.url)) {
      const route = staticRoutes.get(req.url);
      if (route) {
        res.writeHead(200, { "Content-Type": route.contentType });
        res.end(await fs.readFile(route.filePath));
        return;
      }
    }
  });
});

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
