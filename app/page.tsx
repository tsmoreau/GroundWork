import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MapPin, Layers, Users, Download } from "lucide-react";
import Nav from "@/components/Nav";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <main className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <MapPin className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-4" data-testid="text-hero-title">
            Groundwork
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-hero-description">
            Draw shapes, lines, and text over satellite imagery to create collaborative property layout plans.
          </p>
        </div>

        <Link href="/login">
          <Button size="lg" className="px-8" data-testid="button-get-started">
            Get Started
          </Button>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Layered Drawing</h3>
            <p className="text-sm text-muted-foreground">
              Organize features into layers for buildings, landscaping, utilities, and more.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Collaborate</h3>
            <p className="text-sm text-muted-foreground">
              Invite team members with role-based permissions to edit or view your plans.
            </p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Export</h3>
            <p className="text-sm text-muted-foreground">
              Export your plans as PNG or PDF for sharing and printing.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
