import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import jwt from "jsonwebtoken";
import { getStaticRoutes, generateHash, log, generateSalt } from "./utils.js";
import { compose, bodyParser, logger } from "./middleware.js";

const DATABASE_NAME = "scroll.db";
const JWT_EXPIRES_IN = 60 * 60;

const database = new DatabaseSync(DATABASE_NAME);
database.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
create table if not exists notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title VARCHAR(255),
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    if (req.method !== "GET") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Method not allowed.",
        }),
      );
    }

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
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Method not allowed.",
        }),
      );
    }

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
    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Method not allowed.",
        }),
      );
    }

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
      "SELECT id, password_hash, salt FROM users WHERE email = ?",
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

    const secret = process.env["JWT_SECRET"];
    if (!secret) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Internal Server Error",
          message: "Failed to get JWT_SECRET.",
        }),
      );
      return;
    }

    const token = jwt.sign({ userID: user.id }, secret, {
      expiresIn: JWT_EXPIRES_IN,
    });

    res.setHeader("Set-Cookie", `token=${token}; HttpOnly; Path=/`);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "User logged in.",
      }),
    );

    return;
  }

  if (req.url === "/api/notes") {
    if (req.method === "GET") {
      const cookie = req.headers.cookie;
      if (!cookie) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorised",
            message: "Missing cookie.",
          }),
        );
        return;
      }

      const [name, token] = cookie?.split("=");

      if (name !== "token" || !token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorised",
            message: "Missing token.",
          }),
        );
        return;
      }

      const secret = process.env["JWT_SECRET"];
      if (!secret) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: "Failed to get JWT_SECRET.",
          }),
        );
        return;
      }

      let payload;

      try {
        payload = jwt.verify(token, secret);
      } catch (error) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorised",
            message: "Failed to verify token.",
          }),
        );
        return;
      }

      const database = new DatabaseSync(DATABASE_NAME);

      const query = database.prepare("SELECT * FROM notes WHERE user_id = ?");

      const notes = query.all(payload.userID);

      database.close();

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ notes }));

      return;
    } else if (req.method === "POST") {
      const cookie = req.headers.cookie;
      if (!cookie) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorised",
            message: "Missing cookie.",
          }),
        );
        return;
      }

      const [name, token] = cookie?.split("=");

      if (name !== "token" || !token) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorised",
            message: "Missing token.",
          }),
        );
        return;
      }

      const secret = process.env["JWT_SECRET"];
      if (!secret) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Internal Server Error",
            message: "Failed to get JWT_SECRET.",
          }),
        );
        return;
      }

      let payload;

      try {
        payload = jwt.verify(token, secret);
      } catch (error) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorised",
            message: "Failed to verify token.",
          }),
        );
        return;
      }

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

      /** @type {{title:any, content:any}} */
      const body = req.body;

      if (!body.title || !body.content) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad Request",
            message: "Title and content are required.",
          }),
        );
        return;
      }

      if (typeof body.title !== "string" || typeof body.content !== "string") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Bad Request",
            message: "Title and content must be string.",
          }),
        );
        return;
      }

      const database = new DatabaseSync(DATABASE_NAME);

      const query = database.prepare(
        "INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)",
      );

      query.run(payload.userID, body.title, body.content);

      database.close();

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          message: "Note created successfully.",
        }),
      );

      return;
    } else {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Method not allowed.",
        }),
      );
    }
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
