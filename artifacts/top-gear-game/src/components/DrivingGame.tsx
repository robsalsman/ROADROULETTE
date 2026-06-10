import { useRef, useEffect, useCallback, useState } from "react";

// ── Canvas constants ──────────────────────────────────────────────────────────
const CW = 800;
const CH = 400;
const GROUND_Y = CH - 56;
const CAR_X = 130;
const CAR_W = 88;
const CAR_H = 46;

// ── Physics ───────────────────────────────────────────────────────────────────
const GRAVITY = 2100;       // px/s²
const JUMP_V = -810;        // px/s
const START_SPEED = 320;    // px/s
const MAX_SPEED = 720;

type ObKind = "rock" | "log" | "barrel" | "cone" | "animal";

interface Ob { x: number; w: number; h: number; kind: ObKind; }
interface Coin { x: number; y: number; taken: boolean; }
interface Particle { x: number; y: number; vx: number; vy: number; life: number; }

// ── Terrain themes ────────────────────────────────────────────────────────────
interface Theme {
  skyTop: string; skyBot: string;
  sun: string;
  hill: string; hillBack: string;
  ground: string; groundLine: string;
  scenery: "acacia" | "snow" | "jungle" | "mountains";
  sceneryColor: string;
}

const THEMES: Record<string, Theme> = {
  africa:  { skyTop: "#3a1500", skyBot: "#e08020", sun: "#ffd070", hill: "#7a3a05", hillBack: "#a8520a", ground: "#6b3a10", groundLine: "#ae6a28", scenery: "acacia",    sceneryColor: "#2a1500" },
  arctic:  { skyTop: "#5a8ac0", skyBot: "#d8eeff", sun: "#ffffff", hill: "#bcd6e8", hillBack: "#a0c2da", ground: "#e8f2fa", groundLine: "#b8d2e4", scenery: "snow",      sceneryColor: "#9ab8d0" },
  vietnam: { skyTop: "#0a4a7a", skyBot: "#5ab06a", sun: "#fff0b0", hill: "#0f5a25", hillBack: "#1a7035", ground: "#2a5a1a", groundLine: "#4a8a2a", scenery: "jungle",    sceneryColor: "#06340f" },
  bolivia: { skyTop: "#2a1000", skyBot: "#c86828", sun: "#ffd890", hill: "#6a3208", hillBack: "#974810", ground: "#5a3415", groundLine: "#9a6030", scenery: "mountains", sceneryColor: "#3a1c08" },
  default: { skyTop: "#0a1a2a", skyBot: "#3a6a5a", sun: "#ffe0a0", hill: "#13402a", hillBack: "#1d5a3a", ground: "#1a3a22", groundLine: "#2e6a40", scenery: "jungle",    sceneryColor: "#06240f" },
};

function getTheme(t: string): Theme {
  const s = t.toLowerCase();
  if (s.includes("africa") || s.includes("serengeti") || s.includes("safari") || s.includes("desert")) return THEMES.africa;
  if (s.includes("arctic") || s.includes("snow") || s.includes("north") || s.includes("circle")) return THEMES.arctic;
  if (s.includes("vietnam") || s.includes("jungle") || s.includes("tropical")) return THEMES.vietnam;
  if (s.includes("boliv") || s.includes("death") || s.includes("mountain")) return THEMES.bolivia;
  return THEMES.default;
}

// ── Scenery drawing (mid parallax layer) ──────────────────────────────────────
function drawSceneryItem(ctx: CanvasRenderingContext2D, theme: Theme, x: number, baseY: number) {
  ctx.fillStyle = theme.sceneryColor;
  switch (theme.scenery) {
    case "acacia": {
      ctx.fillRect(x - 2, baseY - 34, 4, 34);
      ctx.beginPath();
      ctx.ellipse(x, baseY - 38, 26, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "snow": {
      ctx.beginPath();
      ctx.moveTo(x - 22, baseY);
      ctx.lineTo(x, baseY - 30);
      ctx.lineTo(x + 22, baseY);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x - 7, baseY - 20);
      ctx.lineTo(x, baseY - 30);
      ctx.lineTo(x + 7, baseY - 20);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "jungle": {
      ctx.fillRect(x - 2, baseY - 40, 4, 40);
      for (let i = 0; i < 5; i++) {
        const a = (i / 4) * Math.PI - Math.PI / 2;
        ctx.save();
        ctx.translate(x, baseY - 40);
        ctx.rotate(a * 0.6);
        ctx.beginPath();
        ctx.ellipse(0, -14, 6, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    }
    case "mountains": {
      ctx.beginPath();
      ctx.moveTo(x - 40, baseY);
      ctx.lineTo(x - 10, baseY - 52);
      ctx.lineTo(x + 14, baseY - 30);
      ctx.lineTo(x + 44, baseY);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
export interface DrivingChallengeProps {
  terrain: string;
  missionTitle: string;
  damageResist?: number;
  laneSpeedBonus?: number;
  collectRadiusBonus?: number;
  scoreMultiplier?: number;
  scoreBonus?: number;
  vehicleSprite?: string;
  onComplete: (earnings: number, conditionDelta: number, distanceKm: number) => void;
  onExit: () => void;
}

export default function DrivingGame({
  terrain,
  collectRadiusBonus = 0,
  scoreMultiplier = 0,
  scoreBonus = 0,
  vehicleSprite,
  onComplete,
  onExit,
}: DrivingChallengeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const spriteImg = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!vehicleSprite) { spriteImg.current = null; return; }
    const img = new Image();
    img.src = vehicleSprite;
    img.onload = () => { spriteImg.current = img; };
    img.onerror = () => { spriteImg.current = null; };
    return () => { img.onload = null; img.onerror = null; };
  }, [vehicleSprite]);

  // Game state in refs
  const carY = useRef(GROUND_Y - CAR_H);
  const carVy = useRef(0);
  const onGround = useRef(true);
  const wheelRot = useRef(0);
  const worldX = useRef(0);
  const distM = useRef(0);
  const speed = useRef(START_SPEED);
  const obstacles = useRef<Ob[]>([]);
  const coins = useRef<Coin[]>([]);
  const particles = useRef<Particle[]>([]);
  const obTimer = useRef(1.4);
  const coinTimer = useRef(0.8);
  const coinsGot = useRef(0);
  const crashed = useRef(false);
  const ended = useRef(false);
  const started = useRef(false);
  const shakeF = useRef(0);
  const frameN = useRef(0);

  const [hudCoins, setHudCoins] = useState(0);
  const [hudDist, setHudDist] = useState(0);
  const [showStart, setShowStart] = useState(true);
  const [crashedView, setCrashedView] = useState(false);

  const theme = getTheme(terrain);

  const jump = useCallback(() => {
    if (ended.current) return;
    if (showStart) { setShowStart(false); started.current = true; return; }
    if (onGround.current && !crashed.current) {
      carVy.current = JUMP_V;
      onGround.current = false;
    }
  }, [showStart]);

  const finish = useCallback((didCrash: boolean) => {
    if (ended.current) return;
    ended.current = true;
    const base = coinsGot.current * 10 + Math.floor(distM.current / 50);
    const earnings = Math.floor(base * (1 + scoreMultiplier)) + scoreBonus;
    const distanceKm = Math.max(1, Math.round(distM.current / 150));
    const conditionDelta = didCrash ? -10 : 0;
    setTimeout(() => onComplete(earnings, conditionDelta, distanceKm), didCrash ? 1400 : 200);
  }, [onComplete, scoreMultiplier, scoreBonus]);

  const spawnObstacle = useCallback(() => {
    const kinds: ObKind[] = ["rock", "log", "barrel", "cone", "animal"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const h = kind === "animal" ? 48 : kind === "cone" ? 36 : 38 + Math.random() * 18;
    const w = kind === "log" ? 56 : kind === "animal" ? 52 : 36;
    obstacles.current.push({ x: CW + 40, w, h, kind });
  }, []);

  const spawnCoins = useCallback(() => {
    const n = 3 + Math.floor(Math.random() * 4);
    const arc = Math.random() < 0.5;
    const baseY = arc ? GROUND_Y - 120 : GROUND_Y - 40;
    const startX = CW + 40;
    for (let i = 0; i < n; i++) {
      const y = arc ? baseY + Math.sin((i / (n - 1)) * Math.PI) * -50 : baseY;
      coins.current.push({ x: startX + i * 42, y, taken: false });
    }
  }, []);

  const loop = useCallback((ts: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) { rafRef.current = requestAnimationFrame(loop); return; }

    if (lastTs.current === null) lastTs.current = ts;
    const dt = Math.min((ts - lastTs.current) / 1000, 0.04);
    lastTs.current = ts;
    frameN.current++;

    const running = started.current && !crashed.current && !ended.current;

    if (running) {
      // Speed ramps up with distance
      speed.current = Math.min(MAX_SPEED, START_SPEED + distM.current * 0.06);
      const ds = speed.current * dt;
      worldX.current += ds;
      distM.current += ds / 6;
      wheelRot.current += (ds / 14);

      // Car physics
      carVy.current += GRAVITY * dt;
      carY.current += carVy.current * dt;
      if (carY.current >= GROUND_Y - CAR_H) {
        if (!onGround.current) {
          // landing dust
          for (let i = 0; i < 6; i++) particles.current.push({ x: CAR_X + 10, y: GROUND_Y, vx: -60 - Math.random() * 80, vy: -40 - Math.random() * 60, life: 0.4 });
        }
        carY.current = GROUND_Y - CAR_H;
        carVy.current = 0;
        onGround.current = true;
      }

      // Spawning
      obTimer.current -= dt;
      if (obTimer.current <= 0) {
        spawnObstacle();
        const gap = Math.max(0.7, 1.5 - distM.current * 0.0006);
        obTimer.current = gap + Math.random() * 0.7;
      }
      coinTimer.current -= dt;
      if (coinTimer.current <= 0) {
        spawnCoins();
        coinTimer.current = 1.6 + Math.random() * 1.4;
      }

      // Move obstacles + collision
      const carBox = { x: CAR_X, y: carY.current, w: CAR_W, h: CAR_H };
      for (const o of obstacles.current) {
        o.x -= ds;
        const ob = { x: o.x, y: GROUND_Y - o.h, w: o.w, h: o.h };
        if (
          carBox.x + carBox.w - 14 > ob.x + 6 &&
          carBox.x + 14 < ob.x + ob.w - 6 &&
          carBox.y + carBox.h - 6 > ob.y + 6
        ) {
          crashed.current = true;
          shakeF.current = 18;
          setCrashedView(true);
          for (let i = 0; i < 18; i++) particles.current.push({ x: CAR_X + CAR_W, y: carY.current + CAR_H / 2, vx: 60 + Math.random() * 200, vy: -120 + Math.random() * 60, life: 0.7 });
          finish(true);
        }
      }
      obstacles.current = obstacles.current.filter(o => o.x > -120);

      // Move coins + collect
      const cr = 26 + collectRadiusBonus / 6;
      for (const c of coins.current) {
        c.x -= ds;
        if (!c.taken) {
          const cx = CAR_X + CAR_W / 2, cy = carY.current + CAR_H / 2;
          if (Math.abs(c.x - cx) < cr && Math.abs(c.y - cy) < cr) {
            c.taken = true;
            coinsGot.current++;
            for (let i = 0; i < 5; i++) particles.current.push({ x: c.x, y: c.y, vx: -20 + Math.random() * 40, vy: -60 - Math.random() * 60, life: 0.4 });
          }
        }
      }
      coins.current = coins.current.filter(c => c.x > -40 && !c.taken);

      if (frameN.current % 12 === 0) {
        setHudCoins(coinsGot.current);
        setHudDist(Math.round(distM.current));
      }
    }

    // Particles
    for (const p of particles.current) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 400 * dt; p.life -= dt;
    }
    particles.current = particles.current.filter(p => p.life > 0);

    if (shakeF.current > 0) shakeF.current--;

    // ── DRAW ───────────────────────────────────────────────────────────────
    ctx.save();
    if (shakeF.current > 0) {
      const m = shakeF.current / 4;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, CW + 40, CH + 40);

    // Sun
    ctx.fillStyle = theme.sun;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(CW - 150, 90, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Back hills (slow parallax)
    const backOff = (worldX.current * 0.15) % 400;
    ctx.fillStyle = theme.hillBack;
    ctx.beginPath();
    ctx.moveTo(-20, GROUND_Y);
    for (let x = -backOff - 20; x < CW + 60; x += 200) {
      ctx.lineTo(x, GROUND_Y - 70);
      ctx.lineTo(x + 100, GROUND_Y - 30);
      ctx.lineTo(x + 200, GROUND_Y - 70);
    }
    ctx.lineTo(CW + 20, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // Front hills (medium parallax)
    const hillOff = (worldX.current * 0.3) % 300;
    ctx.fillStyle = theme.hill;
    ctx.beginPath();
    ctx.moveTo(-20, GROUND_Y);
    for (let x = -hillOff - 20; x < CW + 60; x += 150) {
      ctx.lineTo(x, GROUND_Y - 40);
      ctx.lineTo(x + 75, GROUND_Y - 14);
      ctx.lineTo(x + 150, GROUND_Y - 40);
    }
    ctx.lineTo(CW + 20, GROUND_Y);
    ctx.closePath();
    ctx.fill();

    // Scenery items (medium parallax)
    const scenSpacing = 230;
    const scenOff = (worldX.current * 0.45) % scenSpacing;
    for (let i = -1; i < CW / scenSpacing + 2; i++) {
      const x = i * scenSpacing - scenOff + 90;
      drawSceneryItem(ctx, theme, x, GROUND_Y - 2);
    }

    // Ground
    ctx.fillStyle = theme.ground;
    ctx.fillRect(-20, GROUND_Y, CW + 40, CH - GROUND_Y + 20);
    // Ground motion lines
    ctx.strokeStyle = theme.groundLine;
    ctx.lineWidth = 3;
    const gOff = worldX.current % 60;
    for (let x = -gOff; x < CW; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 18);
      ctx.lineTo(x + 26, GROUND_Y + 18);
      ctx.stroke();
    }
    // Ground top edge
    ctx.fillStyle = theme.groundLine;
    ctx.fillRect(-20, GROUND_Y - 3, CW + 40, 3);

    // Coins
    for (const c of coins.current) {
      if (c.taken) continue;
      const wob = Math.abs(Math.sin(worldX.current * 0.02 + c.x * 0.05));
      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 10 * (0.4 + wob * 0.6), 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#7a4a00";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (wob > 0.5) ctx.fillText("£", c.x, c.y + 1);
    }

    // Obstacles
    for (const o of obstacles.current) {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(o.x + o.w / 2, GROUND_Y + 4, o.w / 2, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      drawObstacle(ctx, o, GROUND_Y);
    }

    // Particles
    for (const p of particles.current) {
      ctx.fillStyle = `rgba(200,180,120,${Math.max(0, p.life * 2)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Car
    drawCar(ctx, CAR_X, carY.current, wheelRot.current, crashed.current, spriteImg.current);

    ctx.restore();
    rafRef.current = requestAnimationFrame(loop);
  }, [theme, collectRadiusBonus, spawnObstacle, spawnCoins, finish]);

  // ── Input ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); jump(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jump]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [loop]);

  return (
    <div className="flex flex-col w-full h-full bg-black select-none">
      {/* HUD */}
      <div className="shrink-0 flex items-center gap-3 px-3 sm:px-4 py-2 bg-black border-b border-zinc-800">
        <button
          onClick={() => { ended.current = true; onExit(); }}
          className="text-xs font-bold text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
        >
          ← EXIT
        </button>
        <div className="flex-1 text-center">
          <span className="font-mono font-black text-base sm:text-lg text-primary">{hudDist}m</span>
          <span className="text-[10px] sm:text-xs text-zinc-500 ml-1">distance</span>
        </div>
        <div className="shrink-0 text-right">
          <span className="font-mono font-bold text-amber-400 text-base sm:text-lg">💰 {hudCoins}</span>
          <span className="text-[10px] sm:text-xs text-zinc-500 ml-1">= £{hudCoins * 10}</span>
        </div>
      </div>

      {/* Canvas + tap-to-jump */}
      <div
        className="flex-1 relative overflow-hidden cursor-pointer flex items-center justify-center bg-black"
        onPointerDown={(e) => { e.preventDefault(); jump(); }}
        style={{ touchAction: "none" }}
      >
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          className="block w-full max-h-full object-contain"
          style={{ aspectRatio: `${CW} / ${CH}` }}
        />

        {/* Start overlay */}
        {showStart && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-sm pointer-events-none px-6 text-center">
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-primary">Driving Challenge</h2>
            <p className="text-sm text-zinc-300 max-w-xs">
              Drive as far as you can. <strong className="text-amber-400">Collect coins</strong>, <strong className="text-white">jump obstacles</strong>. Bank your winnings before you crash!
            </p>
            <div className="px-5 py-3 rounded-2xl border-2 border-primary/60 bg-primary/10 text-primary font-black uppercase tracking-wide animate-pulse">
              Tap / Space to start &amp; jump
            </div>
          </div>
        )}

        {/* Crash overlay */}
        {crashedView && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 pointer-events-none">
            <h2 className="text-3xl sm:text-4xl font-black uppercase text-red-400">CRASH!</h2>
            <p className="text-amber-400 font-mono font-bold text-lg">+£{Math.floor((hudCoins * 10 + Math.floor(hudDist / 50)) * (1 + scoreMultiplier)) + scoreBonus} banked</p>
            <p className="text-zinc-400 text-sm">{hudDist}m · {hudCoins} coins</p>
          </div>
        )}

        {/* Jump button (mobile-friendly, also works as click) */}
        {!showStart && !crashedView && (
          <button
            onPointerDown={(e) => { e.preventDefault(); jump(); }}
            className="absolute right-4 bottom-4 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/30 border-2 border-primary/70 flex items-center justify-center text-primary font-black text-sm uppercase active:bg-primary/50 active:scale-95 transition-all"
            style={{ touchAction: "none" }}
          >
            JUMP
          </button>
        )}

        {/* Bank/exit early button */}
        {!showStart && !crashedView && (
          <button
            onClick={(e) => { e.stopPropagation(); finish(false); }}
            className="absolute left-4 bottom-4 px-4 py-2 rounded-xl bg-green-600/30 border-2 border-green-500/60 text-green-300 font-bold text-xs uppercase active:scale-95 transition-all"
          >
            Bank £{Math.floor((hudCoins * 10 + Math.floor(hudDist / 50)) * (1 + scoreMultiplier)) + scoreBonus}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Car drawing (side profile) ────────────────────────────────────────────────
function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, wheelRot: number, crashed: boolean, sprite?: HTMLImageElement | null) {
  const w = CAR_W, h = CAR_H;
  ctx.save();
  ctx.translate(x, y);
  if (crashed) {
    ctx.translate(w / 2, h / 2);
    ctx.rotate(0.18);
    ctx.translate(-w / 2, -h / 2);
  }

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(w / 2, h + 8, w / 2, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Vehicle sprites already include wheels; do not draw the fallback wheels.
  if (sprite && sprite.complete && sprite.naturalWidth > 0) {
    const spriteH = h * 1.5;
    const spriteW = w * 1.18;
    ctx.drawImage(sprite, (w - spriteW) / 2, h - spriteH + h * 0.18, spriteW, spriteH);
    ctx.restore();
    return;
  }

  // Body
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#fbbf24");
  grad.addColorStop(1, "#d97706");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(0, h * 0.4, w, h * 0.6, 6);
  ctx.fill();

  // Cabin
  ctx.beginPath();
  ctx.moveTo(w * 0.2, h * 0.42);
  ctx.lineTo(w * 0.32, h * 0.02);
  ctx.lineTo(w * 0.72, h * 0.02);
  ctx.lineTo(w * 0.82, h * 0.42);
  ctx.closePath();
  ctx.fill();

  // Windows
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.moveTo(w * 0.27, h * 0.4);
  ctx.lineTo(w * 0.35, h * 0.1);
  ctx.lineTo(w * 0.5, h * 0.1);
  ctx.lineTo(w * 0.5, h * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(w * 0.54, h * 0.4);
  ctx.lineTo(w * 0.54, h * 0.1);
  ctx.lineTo(w * 0.68, h * 0.1);
  ctx.lineTo(w * 0.76, h * 0.4);
  ctx.closePath();
  ctx.fill();

  // Roof rack
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.34, h * 0.02);
  ctx.lineTo(w * 0.7, h * 0.02);
  ctx.stroke();

  // Headlight
  ctx.fillStyle = "#fff7d0";
  ctx.beginPath();
  ctx.roundRect(w - 6, h * 0.5, 5, 7, 2);
  ctx.fill();

  // Wheels
  drawWheels(ctx, w, h, wheelRot);

  ctx.restore();
}

function drawObstacle(ctx: CanvasRenderingContext2D, o: Ob, groundY: number) {
  const x = o.x;
  const y = groundY - o.h;

  ctx.save();
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";

  switch (o.kind) {
    case "rock": {
      ctx.fillStyle = "#7f8a86";
      ctx.strokeStyle = "#2f3a37";
      ctx.beginPath();
      ctx.moveTo(x + o.w * 0.18, groundY);
      ctx.lineTo(x + o.w * 0.06, y + o.h * 0.58);
      ctx.lineTo(x + o.w * 0.35, y + o.h * 0.18);
      ctx.lineTo(x + o.w * 0.7, y + o.h * 0.08);
      ctx.lineTo(x + o.w * 0.96, y + o.h * 0.48);
      ctx.lineTo(x + o.w * 0.82, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.moveTo(x + o.w * 0.32, y + o.h * 0.35);
      ctx.lineTo(x + o.w * 0.56, y + o.h * 0.22);
      ctx.lineTo(x + o.w * 0.72, y + o.h * 0.44);
      ctx.lineTo(x + o.w * 0.42, y + o.h * 0.5);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "log": {
      ctx.fillStyle = "#8b5a2b";
      ctx.strokeStyle = "#3f2412";
      ctx.beginPath();
      ctx.roundRect(x, groundY - o.h * 0.62, o.w, o.h * 0.34, 8);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#5f3618";
      for (let i = 0; i < 3; i++) {
        const lx = x + o.w * (0.22 + i * 0.22);
        ctx.beginPath();
        ctx.moveTo(lx, groundY - o.h * 0.6);
        ctx.lineTo(lx + 8, groundY - o.h * 0.3);
        ctx.stroke();
      }
      break;
    }
    case "barrel": {
      ctx.fillStyle = "#9f342d";
      ctx.strokeStyle = "#3b1513";
      ctx.beginPath();
      ctx.roundRect(x + o.w * 0.12, y + 4, o.w * 0.76, o.h - 4, 8);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#f6c453";
      ctx.beginPath();
      ctx.moveTo(x + o.w * 0.18, y + o.h * 0.38);
      ctx.lineTo(x + o.w * 0.82, y + o.h * 0.38);
      ctx.moveTo(x + o.w * 0.18, y + o.h * 0.68);
      ctx.lineTo(x + o.w * 0.82, y + o.h * 0.68);
      ctx.stroke();
      break;
    }
    case "cone": {
      ctx.fillStyle = "#f97316";
      ctx.strokeStyle = "#7c2d12";
      ctx.beginPath();
      ctx.moveTo(x + o.w * 0.5, y);
      ctx.lineTo(x + o.w * 0.14, groundY);
      ctx.lineTo(x + o.w * 0.86, groundY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff7ed";
      ctx.fillRect(x + o.w * 0.28, y + o.h * 0.55, o.w * 0.44, 5);
      break;
    }
    case "animal": {
      ctx.fillStyle = "#d8c59a";
      ctx.strokeStyle = "#3b2f1a";
      ctx.beginPath();
      ctx.roundRect(x + 4, y + o.h * 0.38, o.w * 0.66, o.h * 0.34, 8);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + o.w * 0.78, y + o.h * 0.38, o.w * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = "#3b2f1a";
      ctx.beginPath();
      ctx.moveTo(x + o.w * 0.73, y + o.h * 0.27);
      ctx.lineTo(x + o.w * 0.66, y + o.h * 0.05);
      ctx.moveTo(x + o.w * 0.84, y + o.h * 0.27);
      ctx.lineTo(x + o.w * 0.95, y + o.h * 0.08);
      ctx.moveTo(x + o.w * 0.2, y + o.h * 0.7);
      ctx.lineTo(x + o.w * 0.16, groundY);
      ctx.moveTo(x + o.w * 0.55, y + o.h * 0.7);
      ctx.lineTo(x + o.w * 0.6, groundY);
      ctx.stroke();
      break;
    }
  }

  ctx.restore();
}

function drawWheels(ctx: CanvasRenderingContext2D, w: number, h: number, wheelRot: number) {
  const wheelY = h;
  for (const wx of [w * 0.24, w * 0.78]) {
    ctx.fillStyle = "#18181b";
    ctx.beginPath();
    ctx.arc(wx, wheelY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#52525b";
    ctx.beginPath();
    ctx.arc(wx, wheelY, 5, 0, Math.PI * 2);
    ctx.fill();
    // spokes
    ctx.strokeStyle = "#a1a1aa";
    ctx.lineWidth = 1.5;
    for (let s = 0; s < 4; s++) {
      const a = wheelRot + (s * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(wx, wheelY);
      ctx.lineTo(wx + Math.cos(a) * 9, wheelY + Math.sin(a) * 9);
      ctx.stroke();
    }
  }
}
