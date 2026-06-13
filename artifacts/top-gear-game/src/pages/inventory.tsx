import { Link } from "wouter";
import { ArrowLeft, Backpack, PackageSearch } from "lucide-react";
import { useListSaves, getListSavesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { ensureStarterInventory, type InventoryItem } from "@/data/campaign";
import { cn } from "@/lib/utils";

function latestSeriesSave(saves: any[] | undefined) {
  return [...(saves ?? [])]
    .filter((save) => save.mode === "series")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
}

const RARITY_CLASS: Record<InventoryItem["rarity"], string> = {
  common: "border-zinc-500/50 text-zinc-300",
  uncommon: "border-green-500/60 text-green-300",
  rare: "border-blue-500/60 text-blue-300",
  legendary: "border-amber-500/70 text-amber-300",
};

export default function Inventory() {
  const { data: saves, isLoading } = useListSaves({ query: { queryKey: getListSavesQueryKey() } });
  const save = latestSeriesSave(saves);
  const items = save ? ensureStarterInventory(save.id) : [];

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Backpack className="h-6 w-6" />
              <h1 className="text-3xl font-black uppercase">Inventory</h1>
            </div>
            <p className="text-muted-foreground">Tools, supplies, permits, souvenirs, and suspiciously useful rubbish.</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="uppercase">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="rounded-md border border-border bg-card p-8 text-muted-foreground">Loading inventory...</div>
        ) : !save ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 p-10 text-center">
            <PackageSearch className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <p className="mb-2 text-lg font-black uppercase">No campaign inventory yet</p>
            <p className="mx-auto mb-6 max-w-xl text-muted-foreground">Start Series Mode to collect tools, permits, supplies, and special road-trip items.</p>
            <Link href="/series-start">
              <Button className="uppercase font-bold">Start Series</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-md border border-border bg-card p-4">
              <p className="text-sm font-bold uppercase">Save #{save.id} - {save.playerName ?? "Campaign Driver"}</p>
              <p className="text-xs text-muted-foreground">Items are persistent and can unlock special event choices during the journey.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {items.map((item) => (
                <div key={item.id} className={cn("rounded-md border bg-card p-4", RARITY_CLASS[item.rarity])}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider opacity-80">{item.category} - {item.rarity}</p>
                      <h2 className="text-lg font-black uppercase text-foreground">{item.name}</h2>
                    </div>
                    <span className="rounded bg-muted px-2 py-1 font-mono text-sm text-foreground">x{item.qty}</span>
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">{item.description}</p>
                  <p className="rounded border border-border bg-muted/30 p-2 text-xs text-foreground">{item.effect}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
