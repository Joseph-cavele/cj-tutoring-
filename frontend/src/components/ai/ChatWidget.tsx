'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Bot, Loader2, MessageCircle, X } from 'lucide-react';

import { cn } from '@/lib/utils';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const GREETING =
  'Hi. I can help with Maths (Grade 8-12) and Physical Science (Grade 10-12). What are you working on?';

/** Signed-out visitors get one extra line, because their thread is not kept. */
const GUEST_NOTE =
  'You are not signed in, so this chat is not saved. Log in to keep your conversations.';

export default function ChatWidget({ isSignedIn = false }: { isSignedIn?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 'greeting', role: 'assistant', content: GREETING },
    ...(isSignedIn
      ? []
      : [{ id: 'guest-note', role: 'assistant' as const, content: GUEST_NOTE }]),
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // How many pixels of the layout viewport the on-screen keyboard is covering.
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Returned by the API on the first turn, then echoed back so the server can
  // keep appending to the same conversation.
  const conversationId = useRef<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  /**
   * iOS does not shrink the layout viewport when the keyboard opens, so a
   * bottom-anchored panel ends up underneath it and the composer becomes
   * unreachable. visualViewport reports the space actually left over; the panel
   * reads this back as --keyboard-inset and lifts itself by that much.
   */
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!isOpen || !viewport) return;

    const sync = () => {
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardInset(Math.max(0, Math.round(covered)));
    };

    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
      // Panel is closing: drop the offset so it reopens in the right place.
      setKeyboardInset(0);
    };
  }, [isOpen]);

  async function send() {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    setInput('');
    setError(null);
    setIsSending(true);
    setMessages((current) => [
      ...current,
      { id: `u-${current.length}`, role: 'user', content: trimmed },
    ]);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          conversationId: conversationId.current,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? 'Request failed');
      }

      // null for a signed-out visitor: there is no thread to continue, so
      // nothing is carried into the next turn.
      conversationId.current = data.conversationId ?? undefined;
      setMessages((current) => [
        ...current,
        { id: `a-${current.length}`, role: 'assistant', content: data.reply },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setIsSending(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      {/* Launcher. 56px target, comfortably above the 44px minimum. */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-controls="ai-chat-panel"
        aria-label={isOpen ? 'Close study assistant' : 'Open study assistant'}
        style={{ '--keyboard-inset': `${keyboardInset}px` } as React.CSSProperties}
        className="fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom)+var(--keyboard-inset,0px))] z-50 inline-flex size-14 items-center justify-center rounded-full bg-brand-blue text-white shadow-[var(--shadow-float)] transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue sm:right-6 sm:bottom-[calc(1.5rem+env(safe-area-inset-bottom)+var(--keyboard-inset,0px))]"
      >
        {isOpen ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>

      <div
        id="ai-chat-panel"
        role="dialog"
        aria-label="AI study assistant"
        hidden={!isOpen}
        style={{ '--keyboard-inset': `${keyboardInset}px` } as React.CSSProperties}
        className={cn(
          'fixed inset-x-3 z-50 flex flex-col overflow-hidden rounded-3xl border border-brand-blue-100 bg-white shadow-[var(--shadow-float)]',
          // dvh rather than vh so mobile browser chrome collapsing does not
          // leave the panel taller than the visible page.
          'bottom-[calc(5rem+env(safe-area-inset-bottom)+var(--keyboard-inset,0px))]',
          'max-h-[calc(100dvh-var(--keyboard-inset,0px)-8rem)]',
          'sm:inset-x-auto sm:right-6 sm:w-96',
          'sm:bottom-[calc(6rem+env(safe-area-inset-bottom)+var(--keyboard-inset,0px))]',
          'sm:max-h-[70dvh]'
        )}
      >
        <header className="flex shrink-0 items-center gap-2.5 border-b border-brand-blue-100 px-4 py-3">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-full bg-brand-amber text-brand-navy"
          >
            <Bot className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold text-brand-navy">Study Assistant</p>
            <p className="text-[11px] text-brand-slate">Maths &amp; Physical Science</p>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap',
                message.role === 'user'
                  ? 'ml-auto bg-brand-blue text-white'
                  : 'bg-brand-blue-50 text-brand-navy'
              )}
            >
              {message.content}
            </div>
          ))}

          {isSending && (
            <p className="flex items-center gap-2 text-[13px] text-brand-slate">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Thinking...
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-2xl bg-red-50 px-3.5 py-2.5 text-[13px] text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="shrink-0 border-t border-brand-blue-100 p-3">
          <div className="flex items-end gap-2">
            <label htmlFor="ai-chat-input" className="sr-only">
              Ask a question
            </label>
            <textarea
              id="ai-chat-input"
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter makes a new line.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask about a topic or a question..."
              // 16px on mobile: anything smaller makes iOS Safari zoom the whole
              // page in on focus, which the user then has to pinch back out of.
              className="max-h-32 min-w-0 flex-1 resize-none rounded-2xl border border-brand-blue-100 px-3.5 py-2.5 text-base text-brand-navy placeholder:text-brand-slate focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand-blue sm:text-[14px]"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={!input.trim() || isSending}
              aria-label="Send message"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white transition-colors hover:bg-brand-blue-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowUp className="size-5" />
            </button>
          </div>

          {/* Required by CLAUDE.md section 17: the AI does not replace the tutor. */}
          <p className="mt-2 text-center text-[11px] leading-snug text-brand-slate">
            AI can make mistakes. Check important answers with your tutor or your
            study materials.
          </p>
        </div>
      </div>
    </>
  );
}
