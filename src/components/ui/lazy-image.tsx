import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./skeleton";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /** Supabase transform width */
  transformWidth?: number;
  /** Supabase transform height */
  transformHeight?: number;
  /** Supabase transform quality (1-100) */
  quality?: number;
  /** Fallback content when no src */
  fallback?: React.ReactNode;
  /** Container className for skeleton wrapper */
  containerClassName?: string;
}

/** Detect Supabase storage URL and append transform params */
const buildSrc = (
  src: string | undefined,
  width?: number,
  height?: number,
  quality?: number
): string | undefined => {
  if (!src) return undefined;
  if (!width && !height && !quality) return src;
  // Only transform Supabase storage URLs
  if (!src.includes("/storage/v1/object/public/")) return src;
  const url = new URL(src);
  // Replace /object/ with /render/image/ for transforms
  const transformUrl = url.href.replace(
    "/storage/v1/object/public/",
    "/storage/v1/render/image/public/"
  );
  const params = new URLSearchParams();
  if (width) params.set("width", String(width));
  if (height) params.set("height", String(height));
  if (quality) params.set("quality", String(quality));
  const separator = transformUrl.includes("?") ? "&" : "?";
  return `${transformUrl}${separator}${params.toString()}`;
};

const LazyImage = ({
  src,
  alt = "",
  className,
  containerClassName,
  transformWidth,
  transformHeight,
  quality = 75,
  fallback,
  ...props
}: LazyImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = useCallback(() => setLoaded(true), []);
  const handleError = useCallback(() => {
    setError(true);
    setLoaded(true);
  }, []);

  if (!src || error) {
    if (fallback) return <>{fallback}</>;
    return <Skeleton className={cn("w-full h-full", containerClassName)} />;
  }

  const transformedSrc = buildSrc(src, transformWidth, transformHeight, quality);

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {!loaded && (
        <Skeleton className="absolute inset-0 w-full h-full z-10" />
      )}
      <img
        src={transformedSrc}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        {...props}
      />
    </div>
  );
};

export default LazyImage;
