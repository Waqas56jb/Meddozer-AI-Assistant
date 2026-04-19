import { useCallback, useEffect, useRef, useState } from 'react';
import { VoiceAgent } from './VoiceAgent';

/** Local dev: use Vite proxy `/api`. Production (separate Vercel app): set VITE_API_BASE_URL = https://your-backend.vercel.app */
const API_BASE = (() => {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (url && String(url).trim()) {
    return `${String(url).replace(/\/$/, '')}/api`;
  }
  return '/api';
})();

const SIDEBAR_QUICK_ACTIONS = [
  { icon: '🔨', label: 'Active Auctions', prompt: 'Show me active auctions on Meddozer right now' },
  { icon: '🛒', label: 'Browse & Buy Equipment', prompt: 'How can I buy used medical equipment on Meddozer?' },
  { icon: '💰', label: 'Sell My Equipment', prompt: 'How do I sell my medical equipment on Meddozer?' },
  { icon: '🏦', label: 'Financing Options', prompt: 'What financing options are available on Meddozer?' },
  { icon: '📦', label: 'Shipping & Crating', prompt: 'Tell me about Meddozer shipping and crating services' },
  { icon: '⭐', label: 'Premium Accounts', prompt: 'What are Meddozer premium account plans and pricing?' },
  { icon: '✨', label: 'Aesthetic Equipment', prompt: 'What aesthetic laser machines are available on Meddozer?' },
  { icon: '🔐', label: 'Escrow Protection', prompt: 'How does escrow protection work on Meddozer?' },
  { icon: '🔬', label: 'Imaging Equipment', prompt: 'What imaging and MRI equipment is available?' },
  { icon: '⏱️', label: 'How Auctions Work', prompt: 'How do soft-close auctions work on Meddozer?' },
  { icon: '📋', label: 'DOA & Return Policy', prompt: 'What is Meddozer DOA and return policy?' },
  { icon: '🆓', label: 'Free Registration', prompt: 'How do I create a free account on Meddozer?' },
];

const WELCOME_PROMPTS = [
  { icon: '🔍', label: 'Browse Inventory', prompt: 'What equipment is currently listed on Meddozer?' },
  { icon: '💰', label: 'Sell Equipment', prompt: 'How do I sell my medical equipment on Meddozer?' },
  { icon: '🏦', label: 'Financing Options', prompt: 'What financing options are available?' },
  { icon: '📦', label: 'Shipping Info', prompt: 'How does Meddozer shipping and crating work?' },
  { icon: '🔨', label: 'Auction Guide', prompt: 'How do auctions work on Meddozer?' },
  { icon: '🔐', label: 'Trust & Safety', prompt: 'How does Meddozer protect buyers and sellers?' },
];

function BrandLogo({ className, width = 40, height = 40 }) {
  return (
    <img
      src="/logo.png"
      alt=""
      className={className}
      width={width}
      height={height}
      decoding="async"
    />
  );
}

function formatMessage(text) {
  let t = text;
  t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.*?)\*/g, '<em>$1</em>');
  t = t.replace(/`(.*?)`/g, '<code>$1</code>');
  t = t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
  const lines = t.split('\n');
  const result = [];
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || /^\d+\.\s/.test(trimmed)) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      const content = trimmed.replace(/^[•\-]\s+/, '').replace(/^\d+\.\s+/, '');
      result.push(`<li>${content}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (trimmed) result.push(`<p style="margin-bottom:6px">${trimmed}</p>`);
    }
  }
  if (inList) result.push('</ul>');
  return result.join('');
}

function WelcomeScreen({ onQuickPrompt }) {
  return (
    <div className="welcome-screen" id="welcomeScreen">
      <div className="welcome-avatar">
        <BrandLogo className="welcome-logo-img" width={120} height={120} />
      </div>
      <div className="welcome-name">Hi, I&apos;m MEDDY</div>
      <div className="welcome-desc">
        Your intelligent AI consultant for{' '}
        <strong style={{ color: 'var(--teal-light)' }}>Meddozer.com</strong> — the trusted marketplace for used
        medical and aesthetic equipment. Ask me anything about buying, bidding, selling, financing, shipping, or
        policies — in <strong style={{ color: 'var(--teal-light)' }}>any language</strong>.
      </div>
      <div className="quick-prompts">
        {WELCOME_PROMPTS.map((p) => (
          <button key={p.label} type="button" className="qp-btn" onClick={() => onQuickPrompt(p.prompt)}>
            {p.icon} {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, text: '' });
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [showHome, setShowHome] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);

  useEffect(() => {
    if (voiceActive) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [voiceActive]);

  const conversationHistoryRef = useRef([]);
  const chatAreaRef = useRef(null);
  const chatInputRef = useRef(null);
  const msgIdRef = useRef(0);

  const nextId = () => {
    msgIdRef.current += 1;
    return msgIdRef.current;
  };

  const scrollChatToEnd = useCallback(() => {
    const el = chatAreaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollChatToEnd();
  }, [messages, isTyping, scrollChatToEnd]);

  useEffect(() => {
    chatInputRef.current?.focus();
  }, []);

  const showToast = useCallback((text) => {
    setToast({ show: true, text });
    window.setTimeout(() => setToast({ show: false, text: '' }), 3500);
  }, []);

  const autoResize = useCallback((el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const addMessage = useCallback((role, content, isFormatted = false) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const id = nextId();
    setMessages((prev) => [...prev, { id, role, content, isFormatted, timeStr }]);
  }, []);

  const sendMessage = useCallback(
    async (overrideText) => {
      const text = (overrideText ?? inputValue).trim();
      if (!text || isLoading) return;

      setIsLoading(true);
      setSidebarMobileOpen(false);
      setShowHome(false);
      setInputValue('');
      requestAnimationFrame(() => {
        if (chatInputRef.current) {
          chatInputRef.current.style.height = 'auto';
        }
      });

      addMessage('user', text, false);

      const history = conversationHistoryRef.current;
      history.push({ role: 'user', content: text });
      if (history.length > 20) {
        conversationHistoryRef.current = history.slice(-20);
      }

      setIsTyping(true);

      try {
        const res = await fetch(`${API_BASE}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationHistoryRef.current,
            language: selectedLanguage !== 'auto' ? selectedLanguage : null,
          }),
        });
        const data = await res.json();
        setIsTyping(false);

        if (data.error) {
          addMessage(
            'bot',
            `⚠️ <strong>Error:</strong> ${data.error}. Please try again or contact <a href="mailto:contact@meddozer.com">contact@meddozer.com</a>`,
            true
          );
        } else {
          const formattedReply = formatMessage(data.reply);
          addMessage('bot', formattedReply, true);
          conversationHistoryRef.current.push({ role: 'assistant', content: data.reply });
        }
      } catch (err) {
        setIsTyping(false);
        addMessage(
          'bot',
          `⚠️ Connection error. Please check your internet or contact <a href="mailto:contact@meddozer.com">contact@meddozer.com</a>`,
          true
        );
        console.error('Chat error:', err);
      }

      setIsLoading(false);
      requestAnimationFrame(() => chatInputRef.current?.focus());
    },
    [inputValue, isLoading, selectedLanguage, addMessage]
  );

  const quickAction = useCallback(
    (prompt) => {
      setInputValue(prompt);
      sendMessage(prompt);
    },
    [sendMessage]
  );

  const handleKeydown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const clearChat = useCallback(() => {
    conversationHistoryRef.current = [];
    setMessages([]);
    msgIdRef.current = 0;
    setShowHome(false);
  }, []);

  const openLeadModal = useCallback(() => setLeadModalOpen(true), []);
  const closeLeadModal = useCallback(() => setLeadModalOpen(false), []);

  const submitLead = useCallback(
    async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const name = fd.get('leadName')?.toString() ?? '';
      const email = fd.get('leadEmail')?.toString() ?? '';
      const phone = fd.get('leadPhone')?.toString() ?? '';
      const type = fd.get('leadType')?.toString() ?? '';
      const budget = fd.get('leadBudget')?.toString() ?? '';
      const equipment = fd.get('leadEquipment')?.toString() ?? '';
      const message = fd.get('leadMessage')?.toString() ?? '';

      const payload = {
        name,
        email,
        phone,
        type,
        budget,
        equipment,
        message,
        timestamp: new Date().toISOString(),
      };

      try {
        await fetch(`${API_BASE}/lead`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch {
        /* fail silently — same as original */
      }

      closeLeadModal();
      showToast('✅ Thank you! Our team will contact you shortly.');
      form.reset();

      const confirmationHtml = `<strong>Thank you, ${name}!</strong> 🎉<br><br>We've received your consultation request for <strong>${equipment || 'medical equipment'}</strong>. Our team will contact you at <strong>${email}</strong> shortly.<br><br>In the meantime, feel free to browse listings at <a href="https://meddozer.com/browse-equipment/" target="_blank">meddozer.com/browse-equipment</a> or ask me anything else!`;
      addMessage('bot', confirmationHtml, true);
      conversationHistoryRef.current.push({
        role: 'assistant',
        content: `Lead captured for ${name} - ${email}. Interested in: ${equipment}`,
      });
    },
    [addMessage, closeLeadModal, showToast]
  );

  return (
    <>
      <button
        type="button"
        className={`sidebar-overlay${sidebarMobileOpen ? ' open' : ''}`}
        aria-label="Close menu"
        onClick={() => setSidebarMobileOpen(false)}
      />
      <aside className={`sidebar${sidebarMobileOpen ? ' mobile-open' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <div className="logo-row">
            <div className="logo-icon">
              <BrandLogo className="brand-logo-img" width={72} height={72} />
            </div>
            <div className="logo-text">
              <span className="logo-name">MEDDOZER</span>
              <span className="logo-sub">Medical Marketplace</span>
            </div>
          </div>
          <div className="status-badge">
            <span className="status-dot" />
            MEDDY is Online · GPT-4o Powered
          </div>
        </div>

        <div className="quick-actions">
          <div className="sidebar-section">
            <div className="sidebar-section-title">Quick Actions</div>
            {SIDEBAR_QUICK_ACTIONS.map((a) => (
              <button key={a.label} type="button" className="qa-btn" onClick={() => quickAction(a.prompt)}>
                <span className="qa-icon">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>

          <div className="listings-widget" style={{ margin: '0 16px 12px' }}>
            <div className="lw-title">Live Marketplace Stats</div>
            <div className="lw-stats">
              <div className="lw-stat">
                <div className="lw-num">10</div>
                <div className="lw-label">Active Listings</div>
              </div>
              <div className="lw-stat">
                <div className="lw-num">4</div>
                <div className="lw-label">Live Auctions</div>
              </div>
              <div className="lw-stat">
                <div className="lw-num">30+</div>
                <div className="lw-label">Categories</div>
              </div>
            </div>
          </div>

          <div className="sidebar-section" style={{ paddingTop: 0 }}>
            <div className="sidebar-section-title">Language</div>
          </div>
          <div className="lang-select-wrap">
            <select
              className="lang-select"
              id="langSelect"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
            >
              <option value="auto">🌐 Auto-Detect Language</option>
              <option value="English">🇺🇸 English</option>
              <option value="Urdu">🇵🇰 اردو (Urdu)</option>
              <option value="Arabic">🇸🇦 عربي (Arabic)</option>
              <option value="Spanish">🇪🇸 Español (Spanish)</option>
              <option value="French">🇫🇷 Français (French)</option>
              <option value="German">🇩🇪 Deutsch (German)</option>
              <option value="Chinese">🇨🇳 中文 (Chinese)</option>
              <option value="Hindi">🇮🇳 हिंदी (Hindi)</option>
              <option value="Turkish">🇹🇷 Türkçe (Turkish)</option>
              <option value="Russian">🇷🇺 Русский (Russian)</option>
            </select>
          </div>
        </div>

        <button type="button" className="lead-btn" onClick={openLeadModal}>
          📞 Get a Free Consultation
        </button>
      </aside>

      <main className="main">
        <div className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              id="mobileMenuBtn"
              onClick={() => setSidebarMobileOpen((o) => !o)}
            >
              ☰
            </button>
            {messages.length > 0 && showHome && (
              <button type="button" className="back-home-btn" onClick={() => setShowHome(false)} title="Back to conversation">
                ← Back
              </button>
            )}
            {messages.length > 0 && !showHome && (
              <button type="button" className="back-home-btn back-home-btn--home" onClick={() => setShowHome(true)} title="Home">
                ← Home
              </button>
            )}
            <div className="topbar-title">
              <span className="topbar-name">MEDDY — Meddozer AI Assistant</span>
              <span className="topbar-sub">Medical Equipment Marketplace · Powered by GPT-4o</span>
            </div>
          </div>
          <div className="topbar-actions">
            <button type="button" className="tb-btn" onClick={clearChat}>
              🗑 Clear
            </button>
            <button type="button" className="tb-btn primary" onClick={openLeadModal}>
              📋 Get Quote
            </button>
          </div>
        </div>

        <div className="chat-area" id="chatArea" ref={chatAreaRef}>
          {(messages.length === 0 || showHome) ? (
            <div>
              <WelcomeScreen onQuickPrompt={(p) => { setShowHome(false); quickAction(p); }} />
              {messages.length > 0 && showHome && (
                <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: '24px' }}>
                  <button type="button" className="continue-chat-btn" onClick={() => setShowHome(false)}>
                    💬 Continue Conversation →
                  </button>
                </div>
              )}
            </div>
          ) : null}
          {messages.map((m) => {
            const bubbleInner =
              m.role === 'bot' && m.isFormatted ? (
                <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: m.content }} />
              ) : (
                <div className="msg-bubble">{m.content}</div>
              );
            return (
              <div key={m.id} className={`msg-row ${m.role}`}>
                <div className={`msg-avatar${m.role === 'bot' ? ' bot-avatar' : ''}`}>
                  {m.role === 'bot' ? <BrandLogo className="msg-bot-logo" width={64} height={64} /> : '👤'}
                </div>
                <div className="msg-content">
                  <span className="msg-name">{m.role === 'bot' ? 'MEDDY' : 'You'}</span>
                  {bubbleInner}
                  <span className="msg-time">{m.timeStr}</span>
                </div>
              </div>
            );
          })}
          {isTyping && !showHome ? (
            <div className="typing-row" id="typingIndicator">
              <div className="msg-avatar bot-avatar typing-avatar">
                <BrandLogo className="msg-bot-logo" width={64} height={64} />
              </div>
              <div className="typing-bubble">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="input-area">
          <div className="input-wrap">
            <textarea
              ref={chatInputRef}
              className="chat-input"
              id="chatInput"
              placeholder="Ask about equipment, pricing, auctions, financing, shipping... in any language"
              rows={1}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                autoResize(e.target);
              }}
              onKeyDown={handleKeydown}
            />
            {voiceActive && (
              <VoiceAgent onClose={(transcript) => {
                setVoiceActive(false);
                if (transcript && transcript.length > 0) {
                  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const sep = { id: `vs_${Date.now()}`, role: 'bot', content: '🎙️ Voice conversation', isFormatted: false, timeStr, isVoiceSep: true };
                  const msgs = transcript.map((m, i) => ({ id: `v_${Date.now()}_${i}`, role: m.role === 'assistant' ? 'bot' : 'user', content: m.text, isFormatted: false, timeStr, fromVoice: true }));
                  setMessages(prev => [...prev, sep, ...msgs]);
                  setShowHome(false);
                }
              }} />
            )}
            <button
              type="button"
              className={`voice-btn${voiceActive ? ' voice-btn--active' : ''}`}
              onClick={() => setVoiceActive(true)}
              title="Start voice input"
              aria-label="Start voice input"
            >
              <svg className="voice-btn__icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/>
                <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="9" y1="22" x2="15" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            <button type="button" className="send-btn" id="sendBtn" disabled={isLoading} onClick={() => sendMessage()}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <div className="input-hint">
            Enter to send · Shift+Enter for new line · Responds in your language ·{' '}
            <a href="https://meddozer.com" target="_blank" rel="noreferrer" style={{ color: 'var(--teal)', textDecoration: 'none' }}>
              meddozer.com
            </a>
          </div>
        </div>
      </main>

      <div
        className={`modal-overlay${leadModalOpen ? ' open' : ''}`}
        id="leadModal"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeLeadModal();
        }}
      >
        <div className="modal">
          <div className="modal-header">
            <span className="modal-title">Get Free Consultation</span>
            <button type="button" className="modal-close" onClick={closeLeadModal}>
              ✕
            </button>
          </div>
          <form onSubmit={submitLead}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="leadName">
                  Full Name *
                </label>
                <input type="text" className="form-input" id="leadName" name="leadName" placeholder="Your name" required />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="leadPhone">
                  Phone
                </label>
                <input type="tel" className="form-input" id="leadPhone" name="leadPhone" placeholder="+1 (555) 000-0000" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="leadEmail">
                Email Address *
              </label>
              <input type="email" className="form-input" id="leadEmail" name="leadEmail" placeholder="your@email.com" required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="leadType">
                  I am a
                </label>
                <select className="form-select" id="leadType" name="leadType" defaultValue="Buyer">
                  <option>Buyer</option>
                  <option>Seller</option>
                  <option>Dealer/Refurbisher</option>
                  <option>Clinic/Hospital</option>
                  <option>Broker</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="leadBudget">
                  Budget Range
                </label>
                <select className="form-select" id="leadBudget" name="leadBudget" defaultValue="Under $1,000">
                  <option>Under $1,000</option>
                  <option>$1,000 – $5,000</option>
                  <option>$5,000 – $25,000</option>
                  <option>$25,000 – $100,000</option>
                  <option>$100,000+</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="leadEquipment">
                Equipment Interest
              </label>
              <input
                type="text"
                className="form-input"
                id="leadEquipment"
                name="leadEquipment"
                placeholder="e.g. SIEMENS MRI, Aesthetic Laser, Dental..."
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="leadMessage">
                Message
              </label>
              <textarea className="form-textarea" id="leadMessage" name="leadMessage" placeholder="Tell us how we can help..." />
            </div>
            <button type="submit" className="modal-submit">
              ✅ Submit — Our Team Will Contact You
            </button>
          </form>
        </div>
      </div>

      <div className={`toast${toast.show ? ' show' : ''}`} id="toast">
        {toast.show ? toast.text : '✅ Your request has been submitted successfully!'}
      </div>
    </>
  );
}
