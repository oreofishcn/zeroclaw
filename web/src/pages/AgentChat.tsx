import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Bot, User, AlertCircle, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { WsMessage } from '@/types/api';
import { WebSocketClient, getOrCreateSessionId } from '@/lib/ws';
import { generateUUID } from '@/lib/uuid';
import { useDraft } from '@/hooks/useDraft';
import { t } from '@/lib/i18n';

interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

const DRAFT_KEY = 'agent-chat';
const CHAT_STORAGE_PREFIX = 'zeroclaw_agent_chat_';
const MAX_VISIBLE_MESSAGES = 100;

function chatStorageKey(): string {
  return `${CHAT_STORAGE_PREFIX}${getOrCreateSessionId()}`;
}

function capMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_VISIBLE_MESSAGES) {
    return messages;
  }
  return messages.slice(messages.length - MAX_VISIBLE_MESSAGES);
}

function loadPersistedMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(chatStorageKey());
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as Array<
      Omit<ChatMessage, 'timestamp'> & { timestamp: string }
    >;
    return capMessages(
      parsed.map((message) => ({
        ...message,
        timestamp: new Date(message.timestamp),
      })),
    );
  } catch {
    return [];
  }
}

function persistMessages(messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(chatStorageKey(), JSON.stringify(capMessages(messages)));
  } catch {
    // Ignore storage failures and keep the in-memory chat usable.
  }
}

function extractToolName(msg: WsMessage): string {
  if (msg.name && msg.name.trim()) {
    return msg.name.trim();
  }

  const content = msg.content?.trim();
  if (!content) {
    return 'tool';
  }

  const quotedName = content.match(/`([^`]+)`/);
  if (quotedName?.[1]) {
    return quotedName[1];
  }

  const plainName = content.match(/^Running\s+([A-Za-z0-9_.-]+)/i);
  if (plainName?.[1]) {
    return plainName[1];
  }

  return 'tool';
}

export default function AgentChat() {
  const { draft, saveDraft, clearDraft } = useDraft(DRAFT_KEY);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadPersistedMessages());
  const [input, setInput] = useState(draft);
  const [typing, setTyping] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocketClient | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pendingContentRef = useRef('');

  // Persist draft to in-memory store so it survives route changes
  useEffect(() => {
    saveDraft(input);
  }, [input, saveDraft]);

  useEffect(() => {
    const ws = new WebSocketClient();

    ws.onOpen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onClose = () => {
      setConnected(false);
    };

    ws.onError = () => {
      setError(t('agent.connection_error'));
    };

    ws.onMessage = (msg: WsMessage) => {
      switch (msg.type) {
        case 'chunk':
          setTyping(true);
          pendingContentRef.current += msg.content ?? '';
          break;

        case 'message':
        case 'done': {
          const content = msg.full_response ?? msg.content ?? pendingContentRef.current;
          if (content) {
            setMessages((prev) =>
              capMessages([
                ...prev,
                {
                  id: generateUUID(),
                  role: 'agent',
                  content,
                  timestamp: new Date(),
                },
              ]),
            );
          }
          pendingContentRef.current = '';
          setTyping(false);
          break;
        }

        case 'tool_call':
          setMessages((prev) =>
            capMessages([
              ...prev,
              {
                id: generateUUID(),
                role: 'agent',
                content: `Running ${extractToolName(msg)}...`,
                timestamp: new Date(),
              },
            ]),
          );
          break;

        case 'tool_result':
          break;

        case 'message_cancelled':
          setTyping(false);
          pendingContentRef.current = '';
          break;

        case 'error':
          setMessages((prev) =>
            capMessages([
              ...prev,
              {
                id: generateUUID(),
                role: 'agent',
                content: `${t('agent.error_prefix')} ${msg.message ?? t('agent.unknown_error')}`,
                timestamp: new Date(),
              },
            ]),
          );
          setTyping(false);
          pendingContentRef.current = '';
          break;
      }
    };

    ws.connect();
    wsRef.current = ws;

    return () => {
      ws.disconnect();
    };
  }, []);

  useEffect(() => {
    persistMessages(messages);
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !wsRef.current?.connected) return;

    setMessages((prev) =>
      capMessages([
        ...prev,
        {
          id: generateUUID(),
          role: 'user',
          content: trimmed,
          timestamp: new Date(),
        },
      ]),
    );

    try {
      wsRef.current.sendMessage(trimmed);
      setTyping(true);
      pendingContentRef.current = '';
    } catch {
      setError(t('agent.send_error'));
    }

    setInput('');
    clearDraft();
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const handleCopy = useCallback((msgId: string, content: string) => {
    const onSuccess = () => {
      setCopiedId(msgId);
      setTimeout(() => setCopiedId((prev) => (prev === msgId ? null : prev)), 2000);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(content).then(onSuccess).catch(() => {
        // Fallback for insecure contexts (HTTP)
        fallbackCopy(content) && onSuccess();
      });
    } else {
      fallbackCopy(content) && onSuccess();
    }
  }, []);

  /**
   * Fallback copy using a temporary textarea for HTTP contexts
   * where navigator.clipboard is unavailable.
   */
  function fallbackCopy(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  const agentBubbleBg = 'linear-gradient(135deg, color-mix(in srgb, var(--color-bg-card) 94%, white 6%), color-mix(in srgb, var(--color-bg-card) 84%, var(--color-bg-secondary) 16%))';
  const userBubbleBg = 'linear-gradient(135deg, var(--color-accent-blue), var(--color-accent-blue-hover))';
  const agentAvatarBg = 'linear-gradient(135deg, color-mix(in srgb, var(--color-bg-elevated) 88%, var(--color-border-default) 12%), color-mix(in srgb, var(--color-bg-secondary) 88%, var(--color-border-subtle) 12%))';

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Connection status bar */}
      {error && (
        <div
          className="px-4 py-2 flex items-center gap-2 text-sm text-[var(--color-status-error-soft)] animate-fade-in"
          style={{
            background: 'color-mix(in srgb, var(--color-status-error) 10%, transparent)',
            borderBottom: '1px solid color-mix(in srgb, var(--color-status-error) 22%, transparent)',
          }}
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-theme-faint animate-fade-in">
            <div className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4 animate-float" style={{ background: 'var(--color-accent-panel)' }}>
              <Bot className="h-8 w-8 text-[#0080ff]" />
            </div>
            <p className="text-lg font-semibold text-theme-primary mb-1">ZeroClaw Agent</p>
            <p className="text-sm text-theme-muted">{t('agent.start_conversation')}</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={msg.id}
            className={`group flex items-start gap-3 ${
              msg.role === 'user' ? 'flex-row-reverse animate-slide-in-right' : 'animate-slide-in-left'
            }`}
            style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}
          >
            <div
              className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                msg.role === 'user'
                  ? ''
                  : ''
              }`}
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, var(--color-accent-blue), color-mix(in srgb, var(--color-accent-blue-hover) 88%, black 12%))'
                  : agentAvatarBg
              }}
            >
              {msg.role === 'user' ? (
                <User className="h-4 w-4 text-white" />
              ) : (
                <Bot className="h-4 w-4 text-[#0080ff]" />
              )}
            </div>
            <div className="relative max-w-[75%]">
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'text-white'
                    : 'text-theme-primary border'
                }`}
                style={{
                  background: msg.role === 'user'
                    ? userBubbleBg
                    : agentBubbleBg,
                  borderColor: msg.role === 'user' ? 'transparent' : 'var(--color-border-default)',
                  boxShadow: msg.role === 'user' ? '0 16px 34px var(--color-accent-shadow)' : 'none',
                }}
              >
                {msg.role === 'agent' ? (
                  <div className="break-words text-sm text-inherit [&_a]:text-[var(--color-link)] [&_a]:underline [&_a]:underline-offset-2 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--color-border-default)] [&_blockquote]:pl-4 [&_blockquote]:text-[var(--color-text-soft)] [&_code]:rounded-md [&_code]:bg-[var(--color-bg-input)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:text-[var(--color-accent-blue)] [&_h1]:mt-4 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:text-[var(--color-text-primary)] [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-[var(--color-text-primary)] [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-[var(--color-text-emphasis)] [&_hr]:my-4 [&_hr]:border-[var(--color-border-default)] [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p]:leading-7 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-[var(--color-border-default)] [&_pre]:bg-[var(--color-bg-input)] [&_pre]:p-3 [&_pre]:text-[13px] [&_pre]:leading-6 [&_pre]:text-[var(--color-text-emphasis)] [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_strong]:text-[var(--color-text-primary)] [&_table]:table-electric [&_tbody_td]:px-4 [&_tbody_td]:py-3 [&_tbody_td]:align-top [&_tbody_td]:text-sm [&_tbody_td]:text-[var(--color-text-emphasis)] [&_thead_th]:text-left [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ children }) => (
                          <div className="my-4 overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--color-border-default)', background: 'var(--color-bg-input)' }}>
                            <table>{children}</table>
                          </div>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                <p
                  className={`text-[10px] mt-1.5 ${
                    msg.role === 'user' ? 'text-white/55' : 'text-theme-faint'
                  }`}
                >
                  {msg.timestamp.toLocaleTimeString()}
                </p>
              </div>
              <button
                onClick={() => handleCopy(msg.id, msg.content)}
                aria-label={t('agent.copy_message')}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-all duration-300 p-1.5 rounded-lg text-theme-muted hover:text-theme-primary"
                style={{ background: 'var(--color-bg-input)', border: '1px solid var(--color-border-default)' }}
              >
                {copiedId === msg.id ? (
                  <Check className="h-3 w-3 text-[var(--color-status-success)]" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex items-start gap-3 animate-fade-in">
            <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: agentAvatarBg }}>
              <Bot className="h-4 w-4 text-[#0080ff]" />
            </div>
            <div className="rounded-2xl px-4 py-3 border" style={{ background: agentBubbleBg, borderColor: 'var(--color-border-default)' }}>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[var(--color-accent-blue)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-[var(--color-accent-blue)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-[var(--color-accent-blue)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 p-4" style={{ borderTop: '1px solid var(--color-border-default)', background: 'var(--color-header-bg)' }}>
        <div className="flex w-full items-start gap-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={connected ? t('agent.type_message') : t('agent.connecting')}
              disabled={!connected}
              className="input-electric w-full px-4 py-3 text-sm resize-none overflow-y-auto disabled:opacity-40"
              style={{ minHeight: '44px', maxHeight: '200px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!connected || !input.trim()}
            className="btn-electric flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center justify-end mt-2 gap-2">
          <span
            className={`inline-block h-1.5 w-1.5 rounded-full glow-dot ${
              connected ? 'text-[var(--color-status-success)] bg-[var(--color-status-success)]' : 'text-[var(--color-status-error)] bg-[var(--color-status-error)]'
            }`}
          />
          <span className="text-[10px] text-theme-faint">
            {connected ? t('agent.connected_status') : t('agent.disconnected_status')}
          </span>
        </div>
      </div>
    </div>
  );
}
