import { useLocation } from "wouter";
import { useListMissions, getListMissionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Mountain, Wallet } from "lucide-react";
import { motion } from "framer-motion";

export default function Missions() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const characterId = searchParams.get("characterId");

  const { data: missions, isLoading } = useListMissions({
    query: { queryKey: getListMissionsQueryKey() }
  });

  const handleSelectMission = (missionId: number) => {
    if (characterId) {
      setLocation(`/mission/${missionId}?characterId=${characterId}`);
    }
  };

  const getMissionImage = (location: string) => {
    const loc = location.toLowerCase();
    if (loc.includes('bolivia')) return "/images/bolivia.png";
    if (loc.includes('vietnam')) return "/images/vietnam.png";
    if (loc.includes('pole') || loc.includes('arctic')) return "/images/north-pole.png";
    return "/images/bolivia.png"; // fallback
  };

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold uppercase tracking-wide">Select Destination</h2>
          <p className="text-muted-foreground">Where are we breaking down today?</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[300px] w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {missions?.map((mission, index) => (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="h-full flex flex-col overflow-hidden hover:border-primary transition-all cursor-pointer group" onClick={() => handleSelectMission(mission.id)} data-testid={`card-mission-${mission.id}`}>
                  <div className="h-40 overflow-hidden relative">
                    <img src={getMissionImage(mission.location)} alt={mission.location} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent"></div>
                    <Badge variant={mission.difficulty === 'hard' ? 'destructive' : 'default'} className="absolute top-4 right-4 uppercase">
                      {mission.difficulty}
                    </Badge>
                  </div>
                  
                  <CardHeader>
                    <CardTitle className="uppercase tracking-tight text-xl">{mission.title}</CardTitle>
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {mission.location}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="flex-1 space-y-4">
                    <p className="text-sm text-muted-foreground line-clamp-3">{mission.description}</p>
                    
                    <div className="flex items-center gap-4 text-sm font-medium">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Mountain className="h-4 w-4 text-primary" />
                        <span className="capitalize">{mission.terrain}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Wallet className="h-4 w-4 text-green-500" />
                        <span>£{mission.budget.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button className="w-full uppercase" disabled={!characterId} data-testid={`button-select-mission-${mission.id}`}>
                      {characterId ? "Select Mission" : "Select Character First"}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
