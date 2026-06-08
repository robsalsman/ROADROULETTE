import { Link, useLocation } from "wouter";
import { useListCharacters, getListCharactersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";

export default function CharacterSelect() {
  const [, setLocation] = useLocation();
  const { data: characters, isLoading } = useListCharacters({
    query: { queryKey: getListCharactersQueryKey() }
  });

  const getCharacterImage = (slug: string) => {
    switch (slug) {
      case "jeremy": return "/images/jeremy.png";
      case "richard": return "/images/hammond.png";
      case "james": return "/images/james.png";
      default: return "";
    }
  };

  return (
    <div className="flex-1 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold uppercase tracking-wide">Select Your Presenter</h2>
          <p className="text-muted-foreground">Who's ruining the trip this time?</p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-[400px] w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {characters?.map((character, index) => (
              <motion.div
                key={character.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className="h-full flex flex-col hover:border-primary transition-colors cursor-pointer" onClick={() => setLocation(`/missions?characterId=${character.id}`)} data-testid={`card-character-${character.slug}`}>
                  <CardHeader className="text-center pb-2">
                    <div className="w-32 h-32 mx-auto rounded-full overflow-hidden mb-4 border-4 border-muted">
                      <img src={getCharacterImage(character.slug)} alt={character.name} className="w-full h-full object-cover" />
                    </div>
                    <CardTitle className="text-2xl uppercase tracking-tighter">{character.name}</CardTitle>
                    <CardDescription className="font-serif italic">"{character.tagline}"</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-6">
                    <p className="text-sm text-muted-foreground">{character.personality}</p>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium uppercase">
                          <span>Confidence</span>
                          <span>{character.stats.confidence}/10</span>
                        </div>
                        <Progress value={character.stats.confidence * 10} className="h-2" />
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium uppercase">
                          <span>Mechanical</span>
                          <span>{character.stats.mechanical}/10</span>
                        </div>
                        <Progress value={character.stats.mechanical * 10} className="h-2" />
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium uppercase">
                          <span>Navigation</span>
                          <span>{character.stats.navigation}/10</span>
                        </div>
                        <Progress value={character.stats.navigation * 10} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full uppercase tracking-wider" data-testid={`button-select-${character.slug}`}>Select {character.name.split(' ')[0]}</Button>
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
