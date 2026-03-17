import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, MessageCircle, Send, Trash2, ChevronLeft, ChevronRight, UtensilsCrossed } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

/* ── Types ── */
interface ImageSlide {
  image_url: string;
  menu_review_id: string | null;
}

interface ReviewInfo {
  menu_item_name: string;
  score: number;
  dish_dna: { component_name: string; component_icon: string; selected_tag: string; selected_score: number }[];
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface PostDetailSheetProps {
  open: boolean;
  onClose: () => void;
  postId: string;
  /** pre-loaded data to avoid flicker */
  preload?: {
    imageUrl: string;
    images: string[];
    caption: string | null;
    likeCount: number;
    commentCount: number;
  };
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาที`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชม.`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} วัน`;
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
};

const PostDetailSheet = ({ open, onClose, postId, preload }: PostDetailSheetProps) => {
  const { user } = useAuth();

  // Post data
  const [post, setPost] = useState<{
    user_id: string;
    caption: string | null;
    created_at: string;
    store_id: string | null;
  } | null>(null);
  const [author, setAuthor] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);
  const [slides, setSlides] = useState<ImageSlide[]>([]);
  const [images, setImages] = useState<string[]>(preload?.images || []);
  const [reviewMap, setReviewMap] = useState<Record<string, ReviewInfo>>({});
  const [activeIdx, setActiveIdx] = useState(0);

  // Likes
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(preload?.likeCount || 0);
  const [showHeart, setShowHeart] = useState(false);

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load post data
  useEffect(() => {
    if (!open || !postId) return;
    setActiveIdx(0);

    const load = async () => {
      // Post + images + likes + comments in parallel
      const [postRes, imagesRes, likesRes, commentsRes] = await Promise.all([
        supabase.from("posts").select("user_id, caption, created_at, store_id").eq("id", postId).single(),
        supabase.from("post_images").select("image_url, sort_order, menu_review_id").eq("post_id", postId).order("sort_order", { ascending: true }),
        supabase.from("post_likes").select("id, user_id").eq("ref_id", postId),
        supabase.from("feed_comments").select("id, user_id, content, created_at").eq("ref_id", postId).order("created_at", { ascending: true }),
      ]);

      if (postRes.data) {
        setPost(postRes.data);
        // Author profile
        const { data: prof } = await supabase
          .from("profiles")
          .select("display_name, avatar_url")
          .eq("id", postRes.data.user_id)
          .single();
        setAuthor(prof);
      }

      if (imagesRes.data && imagesRes.data.length > 0) {
        const slideData = imagesRes.data.map((i) => ({ image_url: i.image_url, menu_review_id: i.menu_review_id }));
        setSlides(slideData);
        setImages(slideData.map((s) => s.image_url));

        // Load review info for slides that have menu_review_id
        const reviewIds = [...new Set(slideData.map((s) => s.menu_review_id).filter(Boolean))] as string[];
        if (reviewIds.length > 0) {
          const { data: reviews } = await supabase
            .from("menu_reviews")
            .select("id, score, menu_item_id")
            .in("id", reviewIds);

          if (reviews && reviews.length > 0) {
            const menuItemIds = [...new Set(reviews.map((r) => r.menu_item_id))];
            const [menuRes, dnaRes] = await Promise.all([
              supabase.from("menu_items").select("id, name").in("id", menuItemIds),
              supabase.from("dish_dna").select("menu_item_id, component_name, component_icon, selected_tag, selected_score").in("menu_item_id", menuItemIds),
            ]);

            const menuMap = new Map((menuRes.data || []).map((m) => [m.id, m.name]));
            const dnaByItem = new Map<string, ReviewInfo["dish_dna"]>();
            (dnaRes.data || []).forEach((d) => {
              if (!dnaByItem.has(d.menu_item_id)) dnaByItem.set(d.menu_item_id, []);
              dnaByItem.get(d.menu_item_id)!.push(d);
            });

            const rMap: Record<string, ReviewInfo> = {};
            reviews.forEach((r) => {
              rMap[r.id] = {
                menu_item_name: menuMap.get(r.menu_item_id) || "เมนู",
                score: r.score,
                dish_dna: dnaByItem.get(r.menu_item_id) || [],
              };
            });
            setReviewMap(rMap);
          }
        }
      } else if (preload?.images) {
        setImages(preload.images);
      }

      // Likes
      const likes = likesRes.data || [];
      setLikeCount(likes.length);
      setLiked(!!user && likes.some((l) => l.user_id === user.id));

      // Comments with profiles
      if (commentsRes.data && commentsRes.data.length > 0) {
        const userIds = [...new Set(commentsRes.data.map((c) => c.user_id))];
        const { data: profiles } = await supabase.from("profiles").select("id, display_name, avatar_url").in("id", userIds);
        const profMap = new Map((profiles || []).map((p) => [p.id, p]));

        setComments(
          commentsRes.data.map((c) => {
            const p = profMap.get(c.user_id);
            return { ...c, display_name: p?.display_name || null, avatar_url: p?.avatar_url || null };
          })
        );
      } else {
        setComments([]);
      }
    };

    load();
  }, [open, postId, user]);

  // Toggle like
  const toggleLike = async () => {
    if (!user) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    if (!wasLiked) {
      navigator.vibrate?.(8);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    }

    if (wasLiked) {
      await supabase.from("post_likes").delete().eq("ref_id", postId).eq("user_id", user.id);
    } else {
      await supabase.from("post_likes").insert({ ref_id: postId, user_id: user.id });
    }
  };

  // Double tap to like
  const lastTap = useRef(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      if (!liked) toggleLike();
      else {
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 800);
      }
    }
    lastTap.current = now;
  };

  // Send comment
  const sendComment = async () => {
    if (!user || !commentText.trim()) return;
    setSendingComment(true);
    const content = commentText.trim();
    setCommentText("");

    const { data } = await supabase
      .from("feed_comments")
      .insert({ ref_id: postId, ref_type: "post", user_id: user.id, content })
      .select("id, user_id, content, created_at")
      .single();

    if (data) {
      const { data: prof } = await supabase.from("profiles").select("display_name, avatar_url").eq("id", user.id).single();
      setComments((prev) => [...prev, { ...data, display_name: prof?.display_name || null, avatar_url: prof?.avatar_url || null }]);
    }
    setSendingComment(false);
  };

  // Delete own comment
  const deleteComment = async (commentId: string) => {
    navigator.vibrate?.(8);
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    await supabase.from("feed_comments").delete().eq("id", commentId);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-foreground/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 350, damping: 32, mass: 0.8 }}
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-luxury max-h-[92vh] flex flex-col overflow-hidden"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-4 pb-3 flex-shrink-0">
              <button onClick={() => { if (post?.user_id) { onClose(); navigate(`/user/${post.user_id}`); } }}
                className="w-9 h-9 rounded-full bg-secondary overflow-hidden flex-shrink-0 active:scale-95 transition-transform">
                {author?.avatar_url ? (
                  <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-muted-foreground">
                    {(author?.display_name || "?").charAt(0)}
                  </div>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {author?.display_name || "ผู้ใช้"}
                </p>
                <p className="text-[10px] text-muted-foreground">{post ? timeAgo(post.created_at) : ""}</p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Image Carousel */}
              <div className="relative w-full aspect-square bg-secondary" onClick={handleDoubleTap}>
                <AnimatePresence mode="wait">
                  <motion.img
                    key={images[activeIdx]}
                    src={images[activeIdx]}
                    alt=""
                    className="w-full h-full object-cover"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  />
                </AnimatePresence>

                {/* Nav arrows */}
                {images.length > 1 && (
                  <>
                    {activeIdx > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => i - 1); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
                      >
                        <ChevronLeft size={14} className="text-foreground" />
                      </button>
                    )}
                    {activeIdx < images.length - 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveIdx((i) => i + 1); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center"
                      >
                        <ChevronRight size={14} className="text-foreground" />
                      </button>
                    )}
                  </>
                )}

                {/* Dots */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {images.map((_, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "w-1.5 h-1.5 rounded-full transition-all",
                          idx === activeIdx ? "bg-white w-3" : "bg-white/50"
                        )}
                      />
                    ))}
                  </div>
                )}

                {/* Counter */}
                {images.length > 1 && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-foreground/50 backdrop-blur-sm">
                    <span className="text-[10px] font-semibold text-white">{activeIdx + 1}/{images.length}</span>
                  </div>
                )}

                {/* Double-tap heart animation */}
                <AnimatePresence>
                  {showHeart && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    >
                      <Heart size={80} fill="white" className="text-white drop-shadow-lg" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Review info for current slide */}
              {(() => {
                const currentSlide = slides[activeIdx];
                const reviewInfo = currentSlide?.menu_review_id ? reviewMap[currentSlide.menu_review_id] : null;
                if (!reviewInfo) return null;

                const scoreEmoji = reviewInfo.score === 2 ? "🤩" : reviewInfo.score === 0 ? "😐" : "😔";
                const scoreBg = reviewInfo.score === 2 ? "bg-emerald-50 border-emerald-200" : reviewInfo.score === 0 ? "bg-muted border-border" : "bg-red-50 border-red-200";
                const scoreText = reviewInfo.score === 2 ? "text-emerald-700" : reviewInfo.score === 0 ? "text-muted-foreground" : "text-red-700";

                return (
                  <motion.div
                    key={currentSlide.menu_review_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn("mx-4 mt-2 p-3 rounded-2xl border", scoreBg)}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <UtensilsCrossed size={14} className={scoreText} />
                      <span className={cn("text-sm font-semibold", scoreText)}>{reviewInfo.menu_item_name}</span>
                      <span className="text-base ml-auto">{scoreEmoji}</span>
                    </div>
                    {reviewInfo.dish_dna.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {reviewInfo.dish_dna.map((d, i) => {
                          const tagBg = d.selected_score === 2 ? "bg-emerald-100 text-emerald-800" : d.selected_score === 0 ? "bg-secondary text-muted-foreground" : "bg-red-100 text-red-800";
                          return (
                            <span key={i} className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", tagBg)}>
                              {d.component_icon} {d.selected_tag}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                );
              })()}

              {/* Actions */}
              <div className="flex items-center gap-4 px-4 py-3">
                <button onClick={toggleLike} className="active:scale-90 transition-transform">
                  <Heart
                    size={24}
                    strokeWidth={2}
                    className={cn(liked ? "text-red-500 fill-red-500" : "text-foreground")}
                  />
                </button>
                <button onClick={() => inputRef.current?.focus()} className="active:scale-90 transition-transform">
                  <MessageCircle size={24} strokeWidth={2} className="text-foreground" />
                </button>
              </div>

              {/* Like count */}
              {likeCount > 0 && (
                <p className="px-4 text-sm font-semibold text-foreground">
                  {likeCount.toLocaleString()} ถูกใจ
                </p>
              )}

              {/* Caption */}
              {post?.caption && (
                <div className="px-4 pt-1 pb-2">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold mr-1.5">{author?.display_name || "ผู้ใช้"}</span>
                    {post.caption}
                  </p>
                </div>
              )}

              {/* Comments */}
              {comments.length > 0 && (
                <div className="px-4 pt-1 pb-2 space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2.5 group">
                      <button onClick={() => { onClose(); navigate(`/user/${c.user_id}`); }}
                        className="w-7 h-7 rounded-full bg-secondary overflow-hidden flex-shrink-0 mt-0.5 active:scale-95 transition-transform">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                            {(c.display_name || "?").charAt(0)}
                          </div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <button onClick={() => { onClose(); navigate(`/user/${c.user_id}`); }}
                            className="font-semibold mr-1.5 hover:underline">{c.display_name || "ผู้ใช้"}</button>
                          {c.content}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(c.created_at)}</p>
                      </div>
                      {user && c.user_id === user.id && (
                        <button
                          onClick={() => deleteComment(c.id)}
                          className="opacity-0 group-active:opacity-100 transition-opacity w-6 h-6 rounded-full flex items-center justify-center"
                        >
                          <Trash2 size={12} className="text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Spacer for input */}
              <div className="h-16" />
            </div>

            {/* Comment input — fixed at bottom */}
            {user && (
              <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-background flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden flex-shrink-0">
                  {author?.avatar_url && post?.user_id === user.id ? (
                    <img src={author.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-muted-foreground">👤</div>
                  )}
                </div>
                <input
                  ref={inputRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendComment()}
                  placeholder="เพิ่มคอมเมนต์..."
                  className="flex-1 text-sm text-foreground bg-transparent outline-none placeholder:text-muted-foreground"
                />
                {commentText.trim() && (
                  <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={sendComment}
                    disabled={sendingComment}
                    className="w-8 h-8 rounded-full bg-score-emerald flex items-center justify-center"
                  >
                    <Send size={14} className="text-white" />
                  </motion.button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PostDetailSheet;
