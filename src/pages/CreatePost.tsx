import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Image, X, Send, MapPin, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import PageTransition from "@/components/PageTransition";
import BottomNav from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";

const CreatePost = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "ไฟล์ใหญ่เกินไป", description: "ขนาดไฟล์ต้องไม่เกิน 10MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const clearImage = () => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
  };

  const handleSubmit = async () => {
    if (!user || !imageFile || uploading) return;
    setUploading(true);

    try {
      // Upload image
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("post-images")
        .upload(path, imageFile, { contentType: imageFile.type });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);

      // Insert post
      const { error: insertErr } = await supabase.from("posts").insert({
        user_id: user.id,
        image_url: urlData.publicUrl,
        caption: caption.trim() || null,
      });

      if (insertErr) throw insertErr;

      toast({ title: "โพสสำเร็จ! 🎉" });
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast({ title: "เกิดข้อผิดพลาด", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 pb-24">
          <p className="text-muted-foreground text-sm">กรุณาเข้าสู่ระบบก่อนโพส</p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate("/auth")}
            className="px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold"
          >
            เข้าสู่ระบบ
          </motion.button>
          <BottomNav />
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/30">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-bold text-foreground">โพสใหม่</h1>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!imageFile || uploading}
              className={cn(
                "flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-semibold transition-all",
                imageFile && !uploading
                  ? "bg-score-emerald text-white shadow-[0_2px_12px_hsl(163_78%_20%/0.3)]"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              {uploading ? "กำลังโพส..." : "โพส"}
            </motion.button>
          </div>
        </div>

        <div className="px-4 pt-4 space-y-4">
          {/* Image area */}
          <AnimatePresence mode="wait">
            {imagePreview ? (
              <motion.div
                key="preview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative rounded-2xl overflow-hidden shadow-luxury border border-border/30"
              >
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full aspect-square object-cover"
                />
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={clearImage}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-luxury"
                >
                  <X size={16} className="text-foreground" />
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="upload"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border-2 border-dashed border-border/50 bg-card aspect-square flex flex-col items-center justify-center gap-6"
              >
                <div className="text-4xl">📸</div>
                <p className="text-sm text-muted-foreground font-medium">แชร์รูปอาหารของคุณ</p>

                <div className="flex gap-3">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold"
                  >
                    <Camera size={16} />
                    ถ่ายรูป
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary text-foreground text-sm font-semibold"
                  >
                    <Image size={16} />
                    เลือกรูป
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Caption */}
          <div className="rounded-2xl bg-card border border-border/30 shadow-luxury overflow-hidden">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="เขียนอะไรสักหน่อย... 🍜"
              maxLength={500}
              rows={3}
              className="w-full bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none"
            />
            <div className="px-4 pb-2 flex justify-end">
              <span className={cn(
                "text-[10px] font-medium",
                caption.length > 450 ? "text-score-ruby" : "text-muted-foreground/40"
              )}>
                {caption.length}/500
              </span>
            </div>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />

        <BottomNav />
      </div>
    </PageTransition>
  );
};

export default CreatePost;
