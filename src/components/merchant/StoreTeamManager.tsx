import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { UserPlus, Copy, Trash2, Loader2, Users, Shield, ChefHat, Check, Link2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/language-context";
import { useMerchant } from "@/lib/merchant-context";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  profile?: { display_name: string | null; email: string | null; avatar_url: string | null };
}

interface Invite {
  id: string;
  token: string;
  role: string;
  expires_at: string;
  used_by: string | null;
  created_at: string;
}

const SHAREABLE_APP_ORIGIN = window.location.hostname.includes("id-preview--")
  ? "https://hello-heart-whispers-72.lovable.app"
  : window.location.origin;

const buildInviteUrl = (token: string) => `${SHAREABLE_APP_ORIGIN}/m/invite/${token}`;

const ROLE_CONFIG = {
  owner: { icon: Shield, color: "text-yellow-500", labelTh: "เจ้าของ", labelEn: "Owner" },
  manager: { icon: Users, color: "text-blue-500", labelTh: "ผู้จัดการ", labelEn: "Manager" },
  staff: { icon: ChefHat, color: "text-muted-foreground", labelTh: "พนักงาน", labelEn: "Staff" },
};

const StoreTeamManager = () => {
  const { language } = useLanguage();
  const { activeStore, refetch } = useMerchant();
  const { toast } = useToast();
  const isTh = language === "th";

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteRole, setInviteRole] = useState<"manager" | "staff">("staff");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [addingByEmail, setAddingByEmail] = useState(false);

  const storeRole = activeStore?.role;
  const canManage = storeRole === "owner" || storeRole === "manager";

  const fetchTeam = useCallback(async () => {
    if (!activeStore) return;
    setLoading(true);

    // Fetch members
    const { data: membersData } = await supabase
      .from("store_members")
      .select("id, user_id, role, created_at")
      .eq("store_id", activeStore.id)
      .order("created_at");

    // Fetch profiles for members
    const memberList: Member[] = [];
    if (membersData) {
      const userIds = membersData.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email, avatar_url")
        .in("id", userIds);

      for (const m of membersData) {
        const profile = profiles?.find((p) => p.id === m.user_id);
        memberList.push({
          ...m,
          profile: profile || undefined,
        });
      }
    }
    setMembers(memberList);

    // Fetch active invites
    if (canManage) {
      const { data: invitesData } = await supabase
        .from("store_invites")
        .select("id, token, role, expires_at, used_by, created_at")
        .eq("store_id", activeStore.id)
        .is("used_by", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      setInvites((invitesData as Invite[]) || []);
    }

    setLoading(false);
  }, [activeStore, canManage]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const handleAddByEmail = async () => {
    if (!activeStore || !emailInput.trim()) return;
    setAddingByEmail(true);
    try {
      const { data, error } = await supabase.rpc("add_store_member_by_email", {
        _store_id: activeStore.id,
        _email: emailInput.trim(),
        _role: inviteRole,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (result?.error) {
        const msg = result.error === "User not found"
          ? (isTh ? "ไม่พบบัญชีผู้ใช้อีเมลนี้" : "No account found with this email")
          : result.error === "Already a member"
            ? (isTh ? "เป็นสมาชิกอยู่แล้ว" : "Already a member")
            : result.error === "Already owner"
              ? (isTh ? "เป็นเจ้าของร้านอยู่แล้ว" : "Already the owner")
              : result.error;
        toast({ title: msg, variant: "destructive" });
      } else {
        toast({ title: isTh ? "✅ เพิ่มสมาชิกแล้ว" : "✅ Member added" });
        setEmailInput("");
        fetchTeam();
        refetch();
      }
    } catch (err: any) {
      toast({ title: isTh ? "เกิดข้อผิดพลาด" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingByEmail(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!activeStore) return;
    setCreatingInvite(true);
    try {
      const { data, error } = await supabase
        .from("store_invites")
        .insert({ store_id: activeStore.id, role: inviteRole, created_by: (await supabase.auth.getUser()).data.user!.id })
        .select("id, token, role, expires_at, used_by, created_at")
        .single();

      if (error) throw error;

      setInvites((prev) => [data as Invite, ...prev]);

      const inviteUrl = buildInviteUrl((data as any).token);
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedToken((data as any).token);
      setTimeout(() => setCopiedToken(null), 3000);

      toast({ title: isTh ? "🔗 สร้างลิงก์เชิญแล้ว (คัดลอกแล้ว)" : "🔗 Invite link created (copied)" });
    } catch (err: any) {
      toast({ title: isTh ? "เกิดข้อผิดพลาด" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    const { error } = await supabase.from("store_invites").delete().eq("id", inviteId);
    if (!error) {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast({ title: isTh ? "ลบลิงก์เชิญแล้ว" : "Invite deleted" });
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase.from("store_members").delete().eq("id", memberId);
    if (!error) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast({ title: isTh ? "ลบสมาชิกแล้ว" : "Member removed" });
      refetch();
    }
  };

  const handleCopyInvite = async (token: string) => {
    const url = buildInviteUrl(token);
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
    toast({ title: isTh ? "📋 คัดลอกลิงก์แล้ว" : "📋 Link copied" });
  };

  if (!activeStore) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Users size={16} />
          {isTh ? "ทีมร้าน" : "Store Team"}
        </h3>
        {storeRole && (
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full bg-secondary", ROLE_CONFIG[storeRole as keyof typeof ROLE_CONFIG]?.color)}>
            {isTh ? ROLE_CONFIG[storeRole as keyof typeof ROLE_CONFIG]?.labelTh : ROLE_CONFIG[storeRole as keyof typeof ROLE_CONFIG]?.labelEn}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Owner */}
          <div className="p-3 rounded-xl bg-secondary/50 border border-border/50">
            <div className="flex items-center gap-2">
              <Shield size={14} className="text-yellow-500 shrink-0" />
              <span className="text-xs font-medium text-foreground flex-1">
                {isTh ? "เจ้าของร้าน" : "Store Owner"}
              </span>
            </div>
          </div>

          {/* Members */}
          {members.length > 0 && (
            <div className="space-y-2">
              {members.map((m) => {
                const rc = ROLE_CONFIG[m.role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.staff;
                const Icon = rc.icon;
                return (
                  <motion.div key={m.id} layout className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center overflow-hidden shrink-0">
                      {m.profile?.avatar_url ? (
                        <img src={m.profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">
                          {(m.profile?.display_name || m.profile?.email || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">
                        {m.profile?.display_name || m.profile?.email || "—"}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Icon size={10} className={rc.color} />
                        <span className={cn("text-[10px] font-medium", rc.color)}>
                          {isTh ? rc.labelTh : rc.labelEn}
                        </span>
                      </div>
                    </div>
                    {canManage && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleRemoveMember(m.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
                      </motion.button>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}

          {members.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">
              {isTh ? "ยังไม่มีสมาชิกเพิ่มเติม" : "No additional members yet"}
            </p>
          )}

          {/* Create invite */}
          {canManage && (
            <div className="space-y-3 pt-2">
              {/* Add by email */}
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                {isTh ? "เพิ่มจากอีเมล" : "Add by Email"}
              </p>
              <div className="flex items-center gap-2">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "manager" | "staff")}
                  className="px-3 py-2.5 rounded-xl bg-secondary text-foreground text-xs border border-border/50 outline-none shrink-0"
                >
                  <option value="staff">{isTh ? "🍳 พนักงาน (Staff)" : "🍳 Staff"}</option>
                  <option value="manager">{isTh ? "👔 ผู้จัดการ (Manager)" : "👔 Manager"}</option>
                </select>
                <div className="relative flex-1">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder={isTh ? "อีเมลสมาชิก" : "Member email"}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-secondary text-foreground text-xs border border-border/50 outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddByEmail(); }}
                  />
                </div>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleAddByEmail} disabled={addingByEmail || !emailInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-score-emerald text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 shrink-0">
                  {addingByEmail ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                  {isTh ? "เพิ่ม" : "Add"}
                </motion.button>
              </div>

              {/* Create invite link */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  {isTh ? "หรือสร้างลิงก์เชิญ" : "Or Create Invite Link"}
                </p>
                <motion.button whileTap={{ scale: 0.95 }} onClick={handleCreateInvite} disabled={creatingInvite}
                  className="px-3 py-1.5 rounded-lg bg-secondary text-foreground text-[11px] font-semibold flex items-center gap-1 disabled:opacity-50">
                  {creatingInvite ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                  {isTh ? "สร้างลิงก์" : "Create Link"}
                </motion.button>
              </div>

              {/* Active invites */}
              {invites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                    {isTh ? "ลิงก์เชิญที่ยังใช้ได้" : "Active Invites"}
                  </p>
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/50 border border-border/30">
                      <Link2 size={12} className="text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          /m/invite/{inv.token.slice(0, 8)}...
                        </p>
                        <p className="text-[9px] text-muted-foreground/60">
                          {isTh ? `หมดอายุ ${new Date(inv.expires_at).toLocaleDateString("th")}` : `Expires ${new Date(inv.expires_at).toLocaleDateString()}`}
                          {" · "}
                          {inv.role === "manager" ? (isTh ? "ผู้จัดการ" : "Manager") : (isTh ? "พนักงาน" : "Staff")}
                        </p>
                      </div>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleCopyInvite(inv.token)}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors">
                        {copiedToken === inv.token ? <Check size={14} className="text-score-emerald" /> : <Copy size={14} />}
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => handleDeleteInvite(inv.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 size={14} />
                      </motion.button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StoreTeamManager;
