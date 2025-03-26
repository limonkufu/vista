import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className, size = "md" }: LogoProps) {
  const sizeClasses = {
    sm: "text-xl",
    md: "text-2xl",
    lg: "text-4xl",
  };

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
