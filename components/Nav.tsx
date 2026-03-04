"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, MapPin } from "lucide-react";

export default function Nav() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isLoading = status === "loading";

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <MapPin className="w-5 h-5 text-primary" />
            <span className="text-lg font-bold tracking-tight">
              Groundwork
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {!isLoading && (
              <>
                {isAuthenticated ? (
                  <>
                    <Link href="/projects" data-testid="link-projects">
                      <Button variant="ghost" size="sm">
                        Projects
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => signOut({ callbackUrl: "/" })}
                      data-testid="button-logout"
                    >
                      <LogOut className="w-4 h-4 mr-1" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <Link href="/login" data-testid="link-login">
                    <Button variant="default" size="sm">
                      Sign In
                    </Button>
                  </Link>
                )}
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
