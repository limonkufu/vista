import { cn } from "@/lib/utils";
import Image from "next/image";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  useImage?: boolean;
}

export function Logo({ className, size = "md", useImage = false }: LogoProps) {
  const sizeClasses = {
    sm: "h-6 w-auto",
    md: "h-8 w-auto",
    lg: "h-12 w-auto",
  };

  if (useImage) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-background rounded-lg p-1">
            <Image
              src="/images/logo.webp"
              alt="VISTA Logo"
              width={120}
              height={40}
              className={cn("object-contain", sizeClasses[size])}
              priority
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-lg blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-background rounded-lg px-3 py-1">
          <span
            className={cn(
              "font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent",
              sizeClasses[size]
            )}
          >
            VISTA
          </span>
        </div>
      </div>
    </div>
  );
}
