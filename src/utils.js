import path from "node:path";
import fs from "node:fs/promises";

/**
 * @param {"INFO" | "WARN" | "ERROR"} level
 * @param {string} msg
 * @returns {void}
 */
export function log(level, msg) {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB");
  const time = now.toLocaleTimeString("en-GB", { hour12: false });
  console.log(`${date} ${time} ${level} ——— ${msg}`);
}

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
export async function getStaticRoutes(srcDir, baseDir) {
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
