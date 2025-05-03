import { log } from "./utils.js";
import jwt from "jsonwebtoken";

/**
 * @callback MiddlewareFunction
 * @param {import("./types.js").ExtendedRequest} req
 * @param {import("./types.js").ExtendedResponse} res
 * @param {() => void} next
 * @returns {void}
 */

/** @type {MiddlewareFunction} */
export function logger(req, res, next) {
  res.on("finish", () => {
    const msg = `${req.method} ${req.url} ${res.statusCode}`;
    log("INFO", msg);
  });

  next();
  return;
}

/** @type {MiddlewareFunction} */
export function body(req, res, next) {
  if (req.method !== "POST") {
    next();
    return;
  }

  if (req.headers["content-type"] !== "application/json") {
    next();
    return;
  }

  /** @type {Buffer[]} */
  let chunks = [];

  req.on(
    "data",
    /** @param {Buffer} chunk  */
    (chunk) => {
      chunks.push(chunk);
    },
  );

  req.on("end", () => {
    try {
      req.body = JSON.parse(Buffer.concat(chunks).toString());
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad request",
          message: `Invalid JSON: ${error}`,
        }),
      );
      return;
    }

    next();
    return;
  });
}

/** @type {MiddlewareFunction} */
export function auth(req, res, next) {
  if (req.url !== "/api/notes" && req.url !== "/api/auth/status") {
    next();
    return;
  }

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

  try {
    req.user = jwt.verify(token, secret);
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

  next();
  return;
}

/**
 * @param {MiddlewareFunction[]} middlewares
 * @param {import("./types.js").ExtendedRequestListner} handler
 * @returns {import("./types.js").ExtendedRequestListner}
 */
export function compose(middlewares, handler) {
  return function (req, res) {
    let idx = 0;
    function next() {
      const middleware = middlewares[idx];
      idx++;
      if (middleware) {
        middleware(req, res, next);
      } else {
        handler(req, res);
        return;
      }
    }
    next();
  };
}
