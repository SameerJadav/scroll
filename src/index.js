import http from "node:http";
import { logger } from "./middleware.js";

const server = http.createServer();

server.on("request", (req, res) => {
  logger(req, res, () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        data: "Hello World!",
      }),
    );
  });
});

let port = process.env["PORT"] ? parseInt(process.env["PORT"]) : 300;

server.on("error", (e) => {
  // @ts-ignore
  if (e.code === "EADDRINUSE") {
    port++;
    console.error(`Port in use, trying ${port}`);
    server.listen(port);
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
