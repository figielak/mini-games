import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { type AuthContext, type Client, CloseCode, matchMaker, Room, ServerError } from "@colyseus/core";
import {
  cleanNick,
  createRng,
  GAMES,
  type GameDefinition,
  type GameResult,
  type LobbyPlayer,
  MAX_PLAYERS,
  type Phase,
  PLAYER_COLORS,
  type Rng,
  ROOM_MESSAGES,
  roomCode,
  type RoomView,
} from "@mini-games/games";
import { openStats } from "./stats.ts";

const RECONNECT_SECONDS = 10 * 60; // telefon na wykładzie śpi między turami
const IDLE_MS = 60 * 60 * 1000;
const ROOMS_PER_IP = 3;
const MESSAGES_PER_SECOND = 10;

// ponytail: licznik w pamięci jednego procesu, wystarczy przy jednym kontenerze na Pi
const roomsByIp = new Map<string, number>();

const dbPath = process.env.DB_PATH ?? "data/games.db";
mkdirSync(dirname(dbPath), { recursive: true });
export const stats = openStats(dbPath);

type Timer = { clear(): void };

interface Match {
  def: GameDefinition<unknown, unknown>;
  state: unknown;
  rng: Rng;
  result: GameResult | null;
}

export class LobbyRoom extends Room {
  maxClients = MAX_PLAYERS;
  private players = new Map<string, LobbyPlayer>();
  private hostId = "";
  private creatorIp: string | undefined;
  private idle?: Timer;

  private phase: Phase = "lobby";
  private gameId: string | null = null;
  private seats: string[] = [];
  private scores: Record<string, number> = {};
  private match: Match | null = null;
  private turnTimer?: Timer;
  private turnEndsAt: number | null = null;
  private messageCounts = new Map<string, { second: number; count: number }>();

  async onCreate() {
    let code = roomCode(Math.random);
    while ((await matchMaker.query({ roomId: code })).length > 0) code = roomCode(Math.random);
    this.roomId = code;
    this.touch();

    this.on("pickGame", (client, { gameId }) => {
      const def = GAMES[gameId];
      if (!this.isHost(client) || this.phase !== "lobby" || !def) return;
      this.gameId = gameId;
      this.seats = [...this.players.keys()].slice(0, def.maxPlayers);
      this.resetReady();
    });

    this.on("ready", (client, { ready }) => {
      const player = this.players.get(client.sessionId);
      if (player && this.phase === "lobby" && this.gameId) player.ready = ready;
    });

    this.on("toggleSeat", (client, { id }) => {
      const def = this.gameId ? GAMES[this.gameId] : undefined;
      if (!this.isHost(client) || this.phase !== "lobby" || !def || !this.players.has(id)) return;
      if (this.seats.includes(id)) this.seats = this.seats.filter((s) => s !== id);
      else if (this.seats.length < def.maxPlayers) this.seats = [...this.seats, id];
    });

    // Kolor zmienia się poza partią; zajętego przez kogoś innego nie da się wziąć.
    this.on("pickColor", (client, { color }) => {
      const player = this.players.get(client.sessionId);
      if (!player || this.phase === "playing") return;
      if ([...this.players.values()].some((p) => p.color === color)) return;
      player.color = color;
    });

    this.on("start", (client) => {
      const def = this.gameId ? GAMES[this.gameId] : undefined;
      if (!this.isHost(client) || this.phase !== "lobby" || !def) return;
      if (this.seats.length < def.minPlayers || this.seats.length > def.maxPlayers) return;
      if (this.seats.some((id) => id !== this.hostId && !this.players.get(id)?.ready)) return;
      this.startMatch(def);
    });

    this.on("move", (client, raw) => {
      if (this.phase !== "playing" || !this.match) return;
      const move = this.match.def.moveSchema.safeParse(raw);
      if (move.success) this.play(client.sessionId, move.data);
    });

    // Po partii `ready` znaczy „chcę rewanż”; rewanż rusza, gdy chcą wszyscy grający.
    this.on("rematch", (client) => {
      const player = this.players.get(client.sessionId);
      if (!player || this.phase !== "over" || !this.seats.includes(client.sessionId)) return;
      player.ready = true;
      this.maybeRematch();
    });

    // Każdy może zakończyć serię i zabrać wszystkich do lobby.
    this.on("toLobby", (client) => {
      if (!this.players.has(client.sessionId) || this.phase !== "over") return;
      this.phase = "lobby";
      this.match = null;
      this.resetReady();
    });
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
    this.players.set(client.sessionId, { id: client.sessionId, nick: auth.nick, color, connected: true, ready: false });
    if (!this.hostId) this.hostId = client.sessionId;
    // Gra już wybrana i jest wolne miejsce: nowy gracz od razu gra, gospodarz nie musi go zaznaczać.
    const def = this.gameId ? GAMES[this.gameId] : undefined;
    if (this.phase === "lobby" && def && this.seats.length < def.maxPlayers) this.seats = [...this.seats, client.sessionId];
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
    this.messageCounts.delete(client.sessionId);
    if (this.hostId === client.sessionId) this.hostId = this.players.keys().next().value ?? "";
    if (this.seats.includes(client.sessionId)) {
      this.seats = this.seats.filter((s) => s !== client.sessionId);
      // Walkower: w grze 1v1 wygrywa ten, kto został.
      if (this.phase === "playing") this.finish(this.seats.length === 1 ? { winner: this.seats[0] } : {});
      else this.maybeRematch();
    }
    this.update();
  }

  onDispose() {
    this.turnTimer?.clear();
    if (this.creatorIp === undefined) return;
    const left = (roomsByIp.get(this.creatorIp) ?? 1) - 1;
    if (left > 0) roomsByIp.set(this.creatorIp, left);
    else roomsByIp.delete(this.creatorIp);
  }

  /** onMessage z limitem wiadomości na sekundę i walidacją zod; po każdej obsłużonej wiadomości rozsyła stan. */
  private on<K extends keyof typeof ROOM_MESSAGES>(
    type: K,
    handler: (client: Client, payload: (typeof ROOM_MESSAGES)[K]["_output"]) => void,
  ) {
    this.onMessage(type, (client: Client, raw: unknown) => {
      if (!this.withinRateLimit(client.sessionId)) return;
      const parsed = ROOM_MESSAGES[type].safeParse(raw);
      if (!parsed.success) return;
      handler(client, parsed.data);
      this.update();
    });
  }

  private withinRateLimit(id: string) {
    const second = Math.floor(Date.now() / 1000);
    const entry = this.messageCounts.get(id);
    if (!entry || entry.second !== second) {
      this.messageCounts.set(id, { second, count: 1 });
      return true;
    }
    return ++entry.count <= MESSAGES_PER_SECOND;
  }

  private isHost(client: Client) {
    return client.sessionId === this.hostId;
  }

  private resetReady() {
    for (const p of this.players.values()) p.ready = false;
  }

  private maybeRematch() {
    const def = this.gameId ? GAMES[this.gameId] : undefined;
    if (this.phase !== "over" || !def || this.seats.length < def.minPlayers) return;
    if (!this.seats.every((id) => this.players.get(id)?.ready)) return;
    // Na zmianę: kto zaczynał, w rewanżu rusza się ostatni.
    this.seats = [...this.seats.slice(1), this.seats[0]];
    this.resetReady();
    this.startMatch(def);
  }

  private startMatch(def: GameDefinition<unknown, unknown>) {
    const rng = createRng(crypto.getRandomValues(new Uint32Array(1))[0]);
    this.match = { def, state: def.setup(this.seats, rng), rng, result: null };
    this.phase = "playing";
    this.startTurnTimer();
  }

  private play(player: string, move: unknown) {
    const match = this.match!;
    if (!match.def.validateMove(match.state, player, move)) return;
    const before = match.def.waitingFor(match.state).join();
    const keyBefore = match.def.turn?.(match.state).key;
    match.state = match.def.applyMove(match.state, player, move, match.rng);
    const result = match.def.isOver(match.state);
    if (result) return this.finish(result);
    if (match.def.turn) {
      if (match.def.turn(match.state).key !== keyBefore) this.startTurnTimer();
      return;
    }
    // Nowy limit, gdy zmienia się, na kogo czekamy, albo jeden gracz ma kolejny ruch (np. strzał po trafieniu).
    // Przestawianie statków w fazie równoczesnej nie przedłuża czasu.
    const after = match.def.waitingFor(match.state);
    if (after.join() !== before || after.length === 1) this.startTurnTimer();
  }

  private finish(result: GameResult) {
    if (!this.match) return;
    this.match.result = result;
    this.phase = "over";
    this.resetReady();
    this.turnTimer?.clear();
    this.turnEndsAt = null;
    if (!result.winner) return;
    this.scores[result.winner] = (this.scores[result.winner] ?? 0) + 1;
    // Kto wyszedł w trakcie, nie siedzi już w seats, więc nie dostaje porażki.
    const nick = (id: string) => this.players.get(id)?.nick ?? "?";
    stats.record(this.gameId!, this.seats.map(nick), nick(result.winner));
  }

  /** Po limicie czasu serwer wykonuje ruch za gracza, który nie zdążył. */
  private startTurnTimer() {
    this.turnTimer?.clear();
    this.turnEndsAt = null;
    const { def, state, rng } = this.match!;
    const seconds = def.turn?.(state).seconds ?? def.turnSeconds;
    if (!seconds || !def.timeoutMove || def.waitingFor(state).length === 0) return;
    const ms = seconds * 1000;
    this.turnEndsAt = Date.now() + ms;
    this.turnTimer = this.clock.setTimeout(() => {
      // Ruch zastępczy za każdego, na kogo wciąż czekamy (w rozstawianiu może to być dwóch graczy).
      for (const player of def.waitingFor(this.match!.state)) {
        if (this.phase !== "playing") break;
        this.play(player, def.timeoutMove!(this.match!.state, player, rng));
      }
      this.update();
    }, ms);
  }

  private update() {
    for (const client of this.clients) client.send("room", this.viewFor(client.sessionId));
    this.touch();
  }

  private viewFor(id: string): RoomView {
    const match = this.match;
    return {
      code: this.roomId,
      hostId: this.hostId,
      players: [...this.players.values()],
      phase: this.phase,
      gameId: this.gameId,
      seats: this.seats,
      scores: this.scores,
      game: match && {
        // Obserwator dostaje widok gracza "", czyli bez czyichkolwiek ukrytych informacji.
        view: match.def.playerView(match.state, this.seats.includes(id) ? id : ""),
        waitingFor: match.def.waitingFor(match.state),
        msLeft: this.turnEndsAt && Math.max(0, this.turnEndsAt - Date.now()),
        result: match.result,
      },
    };
  }

  /** Pokój bez żadnej zmiany przez godzinę jest zamykany. */
  private touch() {
    this.idle?.clear();
    this.idle = this.clock.setTimeout(() => this.disconnect(), IDLE_MS);
  }
}
