import { SiGithub } from "@icons-pack/react-simple-icons";

export function Footer() {
  return (
    <footer className="py-4 text-center text-sm text-muted-foreground border-t">
      <p className="flex items-center justify-center gap-1">
        Created with ❤️ via{" "}
        <a
          href="https://en.wikipedia.org/wiki/Vibe_coding"
          target="_blank"
          rel="noopener noreferrer"
          className="text-purple-500 italic"
        >
          Vibe Coding
        </a>
        thanks to almost all the leading LLMs and Marvin the Paranoid Android.
        <a
          href="https://github.com/your-username/your-repo-name"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500"
        >
          <SiGithub size={16} />
        </a>
      </p>
    </footer>
  );
}
