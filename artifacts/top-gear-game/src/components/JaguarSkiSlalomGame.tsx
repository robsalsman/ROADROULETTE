import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const W = 420;
const H = 720;
const CAR_W = 58;
const CAR_H = 82;
const RUN_SECONDS = 45;

type Phase = "ready" | "playing" | "finished";

interface Gate {
  id: number;
  y: number;
  centerX: number;
  gap: number;
  scored: boolean;
}

interface Hazard {
  x: number;
  y: number;
  r: number;
  hit: boolean;
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export default function JaguarSkiSlalomGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTs = useRef<number | null>(null);
  const carImg = useRef<HTMLImageElement | null>(null);
  const keys = useRef({ left: false, right: false });
  const pointerX = useRef<number | null>(null);
  const carX = useRef(W / 2);
  const speed = useRef(210);
  const elapsed = useRef(0);
  const nextGateId = useRef(1);
  const gateTimer = useRef(0.2);
  const hazardTimer = useRef(1.8);
  const gates = useRef<Gate[]>([]);
  const hazards = useRef<Hazard[]>([]);
  const sparks = useRef<Spark[]>([]);

  const [phase, setPhase] = useState<Phase>("ready");
  const [gatesHit, setGatesHit] = useState(0);
  const [gatesMissed, setGatesMissed] = useState(0);
  const [damage, setDamage] = useState(0);
  const [timeLeft, setTimeLeft] = useState(RUN_SECONDS);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const img = new Image();
    img.src = "/images/vehicles/sportscar.png";
    img.onload = () => { carImg.current = img; };
    img.onerror = () => { carImg.current = null; };
    return () => { img.onload = null; img.onerror = null; };
  }, []);

  const resetRun = useCallback(() => {
    carX.current = W / 2;
    speed.current = 210;
    elapsed.current = 0;
    nextGateId.current = 1;
    gateTimer.current = 0.1;
    hazardTimer.current = 1.6;
    gates.current = [];
    hazards.current = [];
    sparks.current = [];
    lastTs.current = null;
    setGatesHit(0);
    setGatesMissed(0);
    setDamage(0);
    setTimeLeft(RUN_SECONDS);
    setDistance(0);
  }, []);

  const startRun = useCallback(() => {
    resetRun();
    setPhase("playing");
  }, [resetRun]);

  const finishRun = useCallback(() => {
    setPhase("finished");
  }, []);

  const addSparks = (x: number, y: number) => {
    for (let i = 0; i < 12; i++) {
      sparks.current.push({
        x,
        y,
        vx: -60 + Math.random() * 120,
        vy: -90 + Math.random() * 50,
        life: 0.5 + Math.random() * 0.4,
      });
    }
  };

  const drawCar = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(elapsed.current * 7) * 0.025);
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(0, CAR_H * 0.44, CAR_W * 0.45, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    if (carImg.current && carImg.current.complete && carImg.current.naturalWidth > 0) {
      ctx.drawImage(carImg.current, -CAR_W / 2, -CAR_H * 0.42, CAR_W, CAR_H * 0.72);
    } else {
      ctx.fillStyle = "#f87171";
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#c7d2fe";
      ctx.fillRect(-CAR_W * 0.32, -CAR_H * 0.25, CAR_W * 0.64, CAR_H * 0.24);
    }
    ctx.restore();
  };

  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, W, H);

    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#dbeafe");
    sky.addColorStop(0.5, "#f8fafc");
    sky.addColorStop(1, "#d9f99d");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W * 0.78, H);
    ctx.lineTo(W * 0.22, H);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = ((elapsed.current * 90 + i * 90) % H);
      ctx.beginPath();
      ctx.moveTo(W * 0.24, y);
      ctx.lineTo(W * 0.76, y + 16);
      ctx.stroke();
    }

    for (const gate of gates.current) {
      const leftX = gate.centerX - gate.gap / 2;
      const rightX = gate.centerX + gate.gap / 2;
      for (const poleX of [leftX, rightX]) {
        ctx.strokeStyle = gate.scored ? "#22c55e" : "#ef4444";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(poleX, gate.y - 24);
        ctx.lineTo(poleX, gate.y + 24);
        ctx.stroke();
        ctx.fillStyle = gate.scored ? "#bbf7d0" : "#fee2e2";
        ctx.beginPath();
        ctx.arc(poleX, gate.y - 29, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = gate.scored ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.25)";
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(leftX, gate.y);
      ctx.lineTo(rightX, gate.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (const hazard of hazards.current) {
      if (hazard.hit) continue;
      ctx.fillStyle = "#94a3b8";
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hazard.x - hazard.r, hazard.y + hazard.r);
      ctx.lineTo(hazard.x - hazard.r * 0.65, hazard.y - hazard.r * 0.45);
      ctx.lineTo(hazard.x + hazard.r * 0.05, hazard.y - hazard.r);
      ctx.lineTo(hazard.x + hazard.r, hazard.y + hazard.r * 0.22);
      ctx.lineTo(hazard.x + hazard.r * 0.45, hazard.y + hazard.r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.arc(hazard.x - hazard.r * 0.22, hazard.y - hazard.r * 0.16, hazard.r * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const spark of sparks.current) {
      ctx.fillStyle = `rgba(251,191,36,${Math.max(0, spark.life * 1.8)})`;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    drawCar(ctx, carX.current, H - 120);
  }, []);

  const loop = useCallback((ts: number) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    if (lastTs.current === null) lastTs.current = ts;
    const dt = Math.min((ts - lastTs.current) / 1000, 0.04);
    lastTs.current = ts;

    if (phase === "playing") {
      elapsed.current += dt;
      speed.current = Math.min(390, speed.current + dt * 5);
      setTimeLeft(Math.max(0, Math.ceil(RUN_SECONDS - elapsed.current)));
      setDistance(Math.round(elapsed.current * 18));

      let steer = 0;
      if (keys.current.left) steer -= 1;
      if (keys.current.right) steer += 1;
      if (pointerX.current !== null) {
        const dx = pointerX.current - carX.current;
        steer += Math.max(-1.15, Math.min(1.15, dx / 80));
      }
      carX.current = Math.max(58, Math.min(W - 58, carX.current + steer * 215 * dt));

      gateTimer.current -= dt;
      if (gateTimer.current <= 0) {
        gates.current.push({
          id: nextGateId.current++,
          y: -40,
          centerX: 105 + Math.random() * 210,
          gap: Math.max(112, 168 - elapsed.current * 1.3),
          scored: false,
        });
        gateTimer.current = Math.max(1.1, 1.65 - elapsed.current * 0.008);
      }

      hazardTimer.current -= dt;
      if (hazardTimer.current <= 0) {
        hazards.current.push({
          x: 70 + Math.random() * (W - 140),
          y: -30,
          r: 16 + Math.random() * 8,
          hit: false,
        });
        hazardTimer.current = 1.25 + Math.random() * 0.8;
      }

      const move = speed.current * dt;
      for (const gate of gates.current) {
        gate.y += move;
        if (!gate.scored && gate.y > H - 120) {
          gate.scored = true;
          const insideGate = carX.current > gate.centerX - gate.gap / 2 && carX.current < gate.centerX + gate.gap / 2;
          if (insideGate) {
            setGatesHit((prev) => prev + 1);
          } else {
            setGatesMissed((prev) => prev + 1);
            setDamage((prev) => Math.min(100, prev + 8));
            addSparks(carX.current, H - 92);
          }
        }
      }
      gates.current = gates.current.filter((gate) => gate.y < H + 60);

      for (const hazard of hazards.current) {
        hazard.y += move;
        if (!hazard.hit) {
          const dx = Math.abs(hazard.x - carX.current);
          const dy = Math.abs(hazard.y - (H - 120));
          if (dx < hazard.r + CAR_W * 0.36 && dy < hazard.r + CAR_H * 0.18) {
            hazard.hit = true;
            setDamage((prev) => Math.min(100, prev + 18));
            addSparks(hazard.x, hazard.y);
          }
        }
      }
      hazards.current = hazards.current.filter((hazard) => hazard.y < H + 60 && !hazard.hit);

      for (const spark of sparks.current) {
        spark.x += spark.vx * dt;
        spark.y += spark.vy * dt;
        spark.vy += 260 * dt;
        spark.life -= dt;
      }
      sparks.current = sparks.current.filter((spark) => spark.life > 0);

      if (elapsed.current >= RUN_SECONDS) finishRun();
    }

    draw(ctx);
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, finishRun, phase]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [loop]);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.current.left = true;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.current.right = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") keys.current.left = false;
      if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") keys.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const score = Math.max(0, gatesHit * 100 - gatesMissed * 45 - damage * 2 + distance);
  const grade = damage > 75 ? "Buried in a snowbank" : gatesHit >= 18 ? "Elegant, for a Jaguar" : gatesHit >= 10 ? "Mostly downhill" : "A gentlemanly disaster";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-black text-white">
      <div className="shrink-0 flex items-center justify-between gap-3 border-b border-zinc-800 py-3 pl-44 pr-4 sm:px-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-primary">Road Trial</p>
          <h1 className="text-lg font-black uppercase leading-tight">Jaguar Ski Slalom</h1>
        </div>
        <div className="flex gap-4 text-right text-xs font-mono">
          <div><span className="text-primary font-black">{timeLeft}s</span><br />time</div>
          <div><span className="text-green-400 font-black">{gatesHit}</span><br />gates</div>
          <div><span className="text-red-400 font-black">{damage}%</span><br />damage</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center p-3">
        <div
          className="relative h-full max-h-[calc(100dvh-96px)] w-full max-w-[520px] overflow-hidden rounded-md border border-zinc-800 bg-zinc-950"
          onPointerDown={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            pointerX.current = ((event.clientX - rect.left) / rect.width) * W;
          }}
          onPointerMove={(event) => {
            if (event.buttons !== 1 && event.pointerType !== "touch") return;
            const rect = event.currentTarget.getBoundingClientRect();
            pointerX.current = ((event.clientX - rect.left) / rect.width) * W;
          }}
          onPointerUp={() => { pointerX.current = null; }}
          onPointerCancel={() => { pointerX.current = null; }}
          style={{ aspectRatio: `${W} / ${H}`, touchAction: "none" }}
        >
          <canvas ref={canvasRef} width={W} height={H} className="block h-full w-full" />

          {phase === "ready" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/65 p-6 text-center">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-primary">Jaaaaaaaags</p>
                <h2 className="text-3xl font-black uppercase">Downhill Slalom</h2>
              </div>
              <p className="max-w-xs text-sm text-zinc-300">
                Steer through the gates, dodge rocks, and try to reach the bottom with some dignity left.
              </p>
              <Button onClick={startRun} size="lg" className="font-black uppercase tracking-widest">
                Start Run
              </Button>
              <p className="text-xs text-zinc-400">Drag left/right, or use A/D and arrow keys.</p>
            </div>
          )}

          {phase === "finished" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/75 p-6 text-center">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-primary">Run Complete</p>
                <h2 className="text-3xl font-black uppercase">{grade}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border border-zinc-700 bg-zinc-900/80 p-3"><strong>{gatesHit}</strong><br />gates cleared</div>
                <div className="rounded-md border border-zinc-700 bg-zinc-900/80 p-3"><strong>{gatesMissed}</strong><br />missed gates</div>
                <div className="rounded-md border border-zinc-700 bg-zinc-900/80 p-3"><strong>{damage}%</strong><br />damage</div>
                <div className="rounded-md border border-zinc-700 bg-zinc-900/80 p-3"><strong>{score}</strong><br />score</div>
              </div>
              <Button onClick={startRun} size="lg" className="font-black uppercase tracking-widest">
                Run Again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
