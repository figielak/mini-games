import { type AuthContext, type Client, CloseCode, matchMaker, Room, ServerError } from "@colyseus/core";
import { cleanNick, type LobbyPlayer, type LobbyView, MAX_PLAYERS, PLAYER_COLORS, roomCode } from "@mini-games/games";

const RECONNECT_SECONDS = 10 * 60; // telefon na wykładzie śpi między turami
const IDLE_MS = 60 * 60 * 1000;
const ROOMS_PER_IP = 3;

// ponytail: licznik w pamięci jednego procesu, wystarczy przy jednym kontenerze na Pi
const roomsByIp = new Map<string, number>();

export class LobbyRoom extends Room {
  maxClients = MAX_PLAYERS;
  private players = new Map<string, LobbyPlayer>();
  private hostId = "";
  private creatorIp: string | undefined;
  private idle?: { clear(): void };

  async onCreate() {
    let code = roomCode(Math.random);
    while ((await matchMaker.query({ roomId: code })).length > 0) code = roomCode(Math.random);
    this.roomId = code;
    this.touch();
  }

  onAuth(_client: Client, options: { nick?: unknown }, context: AuthContext) {
    const nick = cleanNick(options?.nick);
    if (!nick) throw new ServerError(400, "Nick musi mieć od 1 do 16 znaków.");

    // Pierwszy wchodzący to twórca pokoju: tylko on liczy się do limitu pokoi na IP.
    if (this.players.size === 0 && this.creatorIp === undefined) {
      const ip = context.headers.get("cf-connecting-ip") ?? context.ip ?? "?";
      const count = roomsByIp.get(ip) ?? 0;
      if (count >= ROOMS_PER_IP) throw new ServerError(429, "Masz już otwarte za dużo pokoi.");
      roomsByIp.set(ip, count + 1);
      this.creatorIp = ip;
    }
    return { nick };
  }

  onJoin(client: Client, _options: unknown, auth: { nick: string }) {
    const taken = new Set([...this.players.values()].map((p) => p.color));
    const color = PLAYER_COLORS.find((c) => !taken.has(c))!;
    this.players.set(client.sessionId, { id: client.sessionId, nick: auth.nick, color, connected: true });
    if (!this.hostId) this.hostId = client.sessionId;
    this.update();
  }

  async onLeave(client: Client, code?: number) {
    const player = this.players.get(client.sessionId);
    if (!player) return;
    if (code !== CloseCode.CONSENTED) {
      player.connected = false;
      this.update();
      try {
        await this.allowReconnection(client, RECONNECT_SECONDS);
        player.connected = true;
        this.update();
        return;
      } catch {
        // nie wrócił na czas
      }
    }
    this.players.delete(client.sessionId);
    if (this.hostId === client.sessionId) this.hostId = this.players.keys().next().value ?? "";
    this.update();
  }

  onDispose() {
    if (this.creatorIp === undefined) return;
    const left = (roomsByIp.get(this.creatorIp) ?? 1) - 1;
    if (left > 0) roomsByIp.set(this.creatorIp, left);
    else roomsByIp.delete(this.creatorIp);
  }

  private update() {
    const view: LobbyView = { code: this.roomId, hostId: this.hostId, players: [...this.players.values()] };
    this.broadcast("lobby", view);
    this.touch();
  }

  /** Pokój bez żadnej zmiany przez godzinę jest zamykany. */
  private touch() {
    this.idle?.clear();
    this.idle = this.clock.setTimeout(() => this.disconnect(), IDLE_MS);
  }
}
