"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold mb-2" data-testid="text-app-title">
            Groundwork
          </h1>
          <p className="text-muted-foreground text-sm">
            Sign in to create and collaborate on property layout plans
          </p>
        </div>
        <Button
          onClick={() => signIn("google", { callbackUrl: "/projects" })}
          className="w-full"
          data-testid="button-google-signin"
        >
          Sign in with Google
        </Button>
      </Card>
    </div>
  );
}
