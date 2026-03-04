"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft, Share2, Settings, MapPin } from "lucide-react";

interface TopBarProps {
  projectName: string;
  onBack: () => void;
  onShare: () => void;
  onSettings: () => void;
  canEdit: boolean;
  userImage?: string | null;
  children?: React.ReactNode;
}

export default function TopBar({
  projectName,
  onBack,
  onShare,
  onSettings,
  canEdit,
  userImage,
  children,
}: TopBarProps) {
  return (
    <header className="h-12 border-b border-border bg-card flex items-center px-2 sm:px-4 gap-2 z-50 shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="shrink-0"
        data-testid="button-back"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline ml-1">Projects</span>
      </Button>

      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <MapPin className="w-4 h-4 text-primary shrink-0" />
        <span
          className="font-semibold text-sm truncate"
          data-testid="text-project-name"
        >
          {projectName}
        </span>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {children}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onShare}
            data-testid="button-share"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline ml-1">Share</span>
          </Button>
        )}
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSettings}
            data-testid="button-settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        )}
        {userImage && (
          <img
            src={userImage}
            alt=""
            className="w-7 h-7 rounded-full ml-1"
            data-testid="img-user-avatar"
          />
        )}
      </div>
    </header>
  );
}
