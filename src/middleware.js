import { IncomingMessage, ServerResponse } from "node:http";
import { log } from "./utils.js";

/**
 * @callback MiddlewareFunction
 * @param {IncomingMessage} req
 * @param {ServerResponse} res
 * @param {import("node:http").RequestListener} next
 * @returns {void}
 */

/** @type {MiddlewareFunction} */
export function logger(req, res, next) {
  res.on("finish", () => {
    const msg = `—— ${req.method} ${req.url} ${res.statusCode}`;
    log("INFO", msg);
  });
  next(req, res);
}
