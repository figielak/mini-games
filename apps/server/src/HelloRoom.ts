import { Room, type Client } from "@colyseus/core";

// Pokój tylko do etapu 0 — sprawdza, że WebSocket przechodzi przez tunel. Zastąpi go GameRoom.
export class HelloRoom extends Room {
  onJoin(_client: Client) {
    this.broadcast("hello", { clients: this.clients.length });
  }

  onLeave(_client: Client) {
    this.broadcast("hello", { clients: this.clients.length });
  }
}
