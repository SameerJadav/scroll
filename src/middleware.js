import { log } from "./utils.js";

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
    const msg = `——— ${req.method} ${req.url} ${res.statusCode}`;
    log("INFO", msg);
  });

  next();
  return;
}

/** @type {MiddlewareFunction} */
export function json(req, res, next) {
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
      res.end(JSON.stringify({ error: "invalid json" }));
      return;
    }

    next();
    return;
  });
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
