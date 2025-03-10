import { useEffect } from 'react';
import { logger } from '@/lib/logger';

type KeyHandler = (event: KeyboardEvent) => void;

interface ShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export function useKeyboardShortcut(
  config: ShortcutConfig,
  handler: KeyHandler,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const matchesKey = event.key.toLowerCase() === config.key.toLowerCase();
      const matchesCtrl = config.ctrlKey === undefined || event.ctrlKey === config.ctrlKey;
      const matchesAlt = config.altKey === undefined || event.altKey === config.altKey;
      const matchesShift = config.shiftKey === undefined || event.shiftKey === config.shiftKey;
      const matchesMeta = config.metaKey === undefined || event.metaKey === config.metaKey;

      if (matchesKey && matchesCtrl && matchesAlt && matchesShift && matchesMeta) {
        event.preventDefault();
        logger.debug('Keyboard shortcut triggered', {
          key: config.key,
          ctrl: config.ctrlKey,
          alt: config.altKey,
          shift: config.shiftKey,
          meta: config.metaKey
        }, 'KeyboardShortcut');
        handler(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, handler, enabled]);
} 