import { IncomingMessage, ServerResponse } from "node:http";

/**
 * @typedef RequestExtras
 * @property {object} [body]
 */

/**
 * @typedef {IncomingMessage & RequestExtras} ExtendedRequest
 */

/**
 * @typedef {ServerResponse} ExtendedResponse
 */

/**
 * @callback ExtendedRequestListner
 * @param {ExtendedRequest} req
 * @param {ExtendedResponse} res
 * @returns {void}
 */
