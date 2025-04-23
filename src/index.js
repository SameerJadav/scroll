import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { getStaticRoutes, generateHash, log, generateSalt } from "./utils.js";
import { compose, bodyParser, logger } from "./middleware.js";

const DATABASE_NAME = "scroll.db";

const database = new DatabaseSync(DATABASE_NAME);
database.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);
database.close();

const publicDir = path.join(process.cwd(), "public");
const staticRoutes = await getStaticRoutes(publicDir, publicDir);

/** @type {import("./types.js").ExtendedRequestListner} */
async function handler(req, res) {
  if (!req.url) {
    log("ERROR", "req.url missing");
    return;
  }

  if (staticRoutes.has(req.url)) {
    const route = staticRoutes.get(req.url);
    if (route) {
      try {
        const content = await fs.readFile(route.filePath);
        res.writeHead(200, { "Content-Type": route.contentType });
        res.end(content);
        return;
      } catch (error) {
        const msg = `Error serving static files: ${error}`;
        log("INFO", msg);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: "Failed to serve static files.",
          }),
        );
        return;
      }
    }
  }

  if (req.url === "/api/auth/signup") {
    if (!req.body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Request body missing.",
        }),
      );
      return;
    }

    /** @type {{email:any,password:any}} */
    const body = req.body;

    if (!body.email || !body.password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Email and password are required.",
        }),
      );
      return;
    }

    if (typeof body.email !== "string" || typeof body.password !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Email and password must be string.",
        }),
      );
      return;
    }

    const database = new DatabaseSync(DATABASE_NAME);

    const query = database.prepare(
      "SELECT EXISTS (SELECT 1 FROM users WHERE email = ?) AS count",
    );

    // @ts-ignore
    if (query.get(body.email).count !== 0) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Conflict",
          message: "Email address already exits.",
        }),
      );
      database.close();
      return;
    }

    const salt = generateSalt();

    const hash = generateHash(body.password, salt);

    const insert = database.prepare(
      "INSERT INTO users (email, password_hash, salt) VALUES (?, ?, ?)",
    );

    insert.run(body.email, hash, salt);

    database.close();

    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "User created successfully",
      }),
    );

    return;
  }

  if (req.url === "/api/auth/login") {
    if (!req.body) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Request body missing.",
        }),
      );
      return;
    }

    /** @type {{email:any, password:any}} */
    const body = req.body;

    if (!body.email || !body.password) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Email and password are required.",
        }),
      );
      return;
    }

    if (typeof body.email !== "string" || typeof body.password !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Request",
          message: "Email and password must be string.",
        }),
      );
      return;
    }

    const database = new DatabaseSync(DATABASE_NAME);

    const query = database.prepare(
      "SELECT email, password_hash, salt FROM users WHERE email = ?",
    );

    const user = query.get(body.email);

    database.close();

    if (!user) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unauthorized",
          message: "Failed to find user.",
        }),
      );
      return;
    }

    const hash = generateHash(body.password, user.salt);

    if (hash !== user.password_hash) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Unauthorized",
          message: "Invalid password.",
        }),
      );
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "User logged in",
      }),
    );

    return;
  }
}

const server = http.createServer();

server.on("request", compose([logger, bodyParser], handler));

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
