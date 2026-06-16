import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { garageApi } from "@/services/garageApi";
import { DRIVER_CHANGED_EVENT, driverScopedQueryKey, getDriverCode, setDriverCode } from "@/data/driverIdentity";
import { toast } from "@/hooks/use-toast";

export default function DriverLoginPanel() {
  const queryClient = useQueryClient();
  const [driverCode, setDriverCodeState] = useState(getDriverCode());
  const [draft, setDraft] = useState(driverCode);

  const profileQuery = useQuery({
    queryKey: driverScopedQueryKey("garage-profile"),
    queryFn: garageApi.profile,
  });

  useEffect(() => {
    const onDriverChanged = () => {
      const nextCode = getDriverCode();
      setDriverCodeState(nextCode);
      setDraft(nextCode);
      void queryClient.invalidateQueries();
    };
    window.addEventListener(DRIVER_CHANGED_EVENT, onDriverChanged);
    return () => window.removeEventListener(DRIVER_CHANGED_EVENT, onDriverChanged);
  }, [queryClient]);

  const saveDriver = () => {
    const next = setDriverCode(draft);
    setDriverCodeState(next);
    void queryClient.invalidateQueries();
    toast({
      title: next ? "Driver loaded" : "Guest garage loaded",
      description: next ? `${next}'s online garage is active on this device.` : "Using the shared guest garage.",
    });
  };

  return (
    <div className="rounded-md border border-border bg-card/80 p-3 shadow-sm">
      <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase">
        <UserRound className="h-4 w-4 text-primary" />
        Driver Login
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Enter driver code"
          maxLength={40}
          data-testid="input-driver-code"
        />
        <Button className="uppercase font-bold" onClick={saveDriver} data-testid="button-driver-login">
          Load
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Active: <span className="font-bold text-foreground">{driverCode || "Guest garage"}</span>
        {profileQuery.data ? ` - Garage GBP ${profileQuery.data.credits.toLocaleString()}` : ""}
      </p>
    </div>
  );
}
