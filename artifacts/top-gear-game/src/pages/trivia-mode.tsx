import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ECONOMY } from "@workspace/economy";
import { ArrowLeft, Brain, CheckCircle2, Shuffle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALL_TRIVIA, triviaByType, type TriviaQuestion } from "@/data/trivia";
import { garageApi } from "@/services/garageApi";
import { cn } from "@/lib/utils";

type QuizMode = "mixed" | "episode" | "vehicle" | "mechanics" | "motorsport" | "geography";

const MODES: Array<{ id: QuizMode; label: string; desc: string }> = [
  { id: "mixed", label: "Mixed Bag", desc: "Episodes, cars, mechanics, geography, and motorsport." },
  { id: "episode", label: "Episode Trivia", desc: "Release order, locations, vehicles, and challenges." },
  { id: "vehicle", label: "Vehicle Facts", desc: "Actual facts about cars from the campaign." },
  { id: "mechanics", label: "Mechanics", desc: "Car-control and engineering basics." },
  { id: "motorsport", label: "Motorsport", desc: "Rallying, racing history, and famous machines." },
];

function pick(pool: TriviaQuestion[], used: Set<string>): TriviaQuestion {
  const fresh = pool.filter((question) => !used.has(question.id));
  const source = fresh.length > 0 ? fresh : pool;
  return source[Math.floor(Math.random() * source.length)] ?? ALL_TRIVIA[0];
}

export default function TriviaMode() {
  const [mode, setMode] = useState<QuizMode>("mixed");
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const pool = useMemo(() => triviaByType(mode), [mode]);
  const [question, setQuestion] = useState<TriviaQuestion>(() => pick(ALL_TRIVIA, new Set()));
  const answered = selected !== null;
  const correct = answered && selected === question.answer;

  const nextQuestion = (nextMode = mode) => {
    const nextPool = triviaByType(nextMode);
    const nextUsed = new Set(used);
    nextUsed.add(question.id);
    setUsed(nextUsed);
    setSelected(null);
    setQuestion(pick(nextPool, nextUsed));
  };

  const answer = (index: number) => {
    if (answered) return;
    if (index === question.answer) {
      void garageApi.awardCredits(15 * ECONOMY.dragRewardMultiplier, "Standalone trivia reward").catch(() => undefined);
    }
    setSelected(index);
    setScore((prev) => ({
      right: prev.right + (index === question.answer ? 1 : 0),
      total: prev.total + 1,
    }));
  };

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Brain className="h-6 w-6" />
              <h1 className="text-3xl font-black uppercase">Trivia</h1>
            </div>
            <p className="text-muted-foreground">Episode lore, actual vehicle facts, and pub-quiz nonsense.</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="uppercase">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMode(item.id);
                setUsed(new Set());
                setSelected(null);
                setQuestion(pick(triviaByType(item.id), new Set()));
              }}
              className={cn(
                "rounded-md border p-3 text-left transition-colors",
                mode === item.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/60",
              )}
            >
              <span className="block text-sm font-black uppercase">{item.label}</span>
              <span className="text-xs text-muted-foreground">{item.desc}</span>
            </button>
          ))}
        </div>

        <div className="rounded-md border border-border bg-card p-5 md:p-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-black uppercase tracking-widest text-primary">
                {(question.type ?? "mixed").replace("-", " ")} - {question.difficulty ?? "medium"}
              </p>
              <h2 className="text-2xl font-black leading-tight">{question.question}</h2>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-right font-mono text-sm">
              {score.right}/{score.total}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {question.options.map((option, index) => {
              const isCorrect = answered && index === question.answer;
              const isWrong = selected === index && index !== question.answer;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => answer(index)}
                  className={cn(
                    "min-h-16 rounded-md border p-4 text-left font-bold transition-colors",
                    isCorrect
                      ? "border-green-500 bg-green-500/15 text-green-300"
                      : isWrong
                        ? "border-red-500 bg-red-500/15 text-red-300"
                        : "border-border hover:border-primary hover:bg-primary/5",
                  )}
                >
                  <span className="flex items-center gap-2">
                    {isCorrect && <CheckCircle2 className="h-4 w-4" />}
                    {isWrong && <XCircle className="h-4 w-4" />}
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {answered && (
            <div className="mt-5 rounded-md border border-border bg-muted/20 p-4">
              <p className="font-bold uppercase">{correct ? "Correct" : "Wrong"}</p>
              <p className="text-sm text-muted-foreground">
                {question.explanation ?? `Answer: ${question.options[question.answer]}.`}
              </p>
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <Button onClick={() => nextQuestion()} className="uppercase font-bold">
              <Shuffle className="mr-2 h-4 w-4" /> Next Question
            </Button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Current pool: {pool.length} questions. Vehicle trivia is designed to grow alongside the full campaign garage.
        </p>
      </div>
    </div>
  );
}
