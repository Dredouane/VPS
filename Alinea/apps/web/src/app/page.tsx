import { Button } from "@alinea/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@alinea/ui/components/card";
import { Badge } from "@alinea/ui/components/badge";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Alinea</CardTitle>
          <CardDescription>
            Backoffice clients PME — pipeline email → facturation
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="warning">P0 scaffolding</Badge>
            <Badge variant="secondary">P1 contrats</Badge>
          </div>
          <p className="text-muted-foreground text-sm">
            Auth, factures, emails et recherche RAG arrivent en P3/P4.
            L&apos;API est contractée par <code>openapi/openapi.yaml</code>,
            généré depuis le SQL.
          </p>
          <Button disabled>Connexion (P4)</Button>
        </CardContent>
      </Card>
    </main>
  );
}
