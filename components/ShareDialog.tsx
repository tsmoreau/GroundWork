"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, UserPlus, Crown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Member {
  _id: string;
  email: string;
  role: string;
  userId: string | null;
}

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  role: string;
}

export default function ShareDialog({
  open,
  onOpenChange,
  projectId,
  role,
}: ShareDialogProps) {
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("editor");
  const [loading, setLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch {}
  }, [projectId]);

  useEffect(() => {
    if (open) fetchMembers();
  }, [open, fetchMembers]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail("");
        fetchMembers();
        toast({ title: "Invite sent" });
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.error || "Failed to invite", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to invite", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        fetchMembers();
        toast({ title: "Role updated" });
      }
    } catch {}
  };

  const handleRemove = async (memberId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchMembers();
        toast({ title: "Member removed" });
      }
    } catch {}
  };

  const isOwner = role === "owner";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
        </DialogHeader>

        {(isOwner || role === "editor") && (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Invite by email</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  data-testid="input-invite-email"
                />
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="w-24" data-testid="select-invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleInvite}
                  disabled={loading || !inviteEmail.trim()}
                  size="sm"
                  data-testid="button-send-invite"
                >
                  <UserPlus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 mt-2">
          <Label className="text-xs">Members</Label>
          {members.map((member) => (
            <div
              key={member._id}
              className="flex items-center justify-between py-2 px-2 rounded border border-border/50"
              data-testid={`member-${member._id}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm truncate">{member.email}</span>
                {member.role === "owner" && (
                  <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                )}
                {!member.userId && (
                  <Badge variant="secondary" className="text-[10px]">
                    Pending
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isOwner && member.role !== "owner" && (
                  <>
                    <Select
                      value={member.role}
                      onValueChange={(v) => handleChangeRole(member._id, v)}
                    >
                      <SelectTrigger className="w-20 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">Editor</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="owner">Owner</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => handleRemove(member._id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                {!isOwner && member.role !== "owner" && (
                  <Badge variant="secondary" className="text-xs">
                    {member.role}
                  </Badge>
                )}
                {member.role === "owner" && (
                  <Badge variant="secondary" className="text-xs">
                    Owner
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
