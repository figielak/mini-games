import { fileURLToPath } from "node:url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import express from "express";
import { HelloRoom } from "./HelloRoom.ts";

const port = Number(process.env.PORT ?? 2567);
const webDist = fileURLToPath(new URL("../../web/dist", import.meta.url));

const server = new Server({
  transport: new WebSocketTransport(),
  express: (app) => {
    app.get("/health", (_req, res) => {
      res.send("ok");
    });
    app.use(express.static(webDist));
  },
});

server.define("hello", HelloRoom);
await server.listen(port);
console.log(`listening on :${port}`);
