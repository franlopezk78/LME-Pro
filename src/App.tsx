import React, { useState, useEffect, useRef } from 'react';
import { Share2, RefreshCw, ShoppingBasket, Edit3, ShoppingCart, Plus, Mic, Trash2, CheckCircle, ChevronDown, Settings, Brain, Save, Loader2, Trash } from 'lucide-react';
import type { ShoppingItem } from './types';
import { CATALOG_DATA } from './constants';

const App: React.FC = () => {
  const APP_VERSION = "5.0 - EviShop Premium";
  
  const [items, setItems] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('lme_items_pro');
    return saved ? JSON.parse(saved) : [];
  });
  const [apiKey, setApiKey] = useState<string>(localStorage.getItem('lme_gemini_key') || '');
  const [showSettings, setShowSettings] = useState(false);
  const [mode, setMode] = useState<'edit' | 'shop'>('edit');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('lme_items_pro', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('lme_gemini_key', apiKey.trim());
  }, [apiKey]);

  // Audio Feedback
  const playBeep = (type: 'start' | 'stop') => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      const now = ctx.currentTime;
      if (type === 'start') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(440, now); osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      } else {
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
      }
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } catch (e) {}
  };

  // Voice Logic (Extreme Single-Shot)
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    const recognition = new SpeechRec();
    recognition.lang = 'es-ES';
    recognition.interimResults = false; // Desactivado total para evitar basura intermedia
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
      playBeep('start');
    };

    recognition.onresult = (e: any) => {
      const result = e.results[0][0].transcript;
      setTranscript(result);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setTranscript('');
      try {
        recognitionRef.current?.start();
      } catch (e) {
        recognitionRef.current?.stop();
        setTimeout(() => recognitionRef.current?.start(), 100);
      }
    }
  };

  useEffect(() => {
    if (!isListening && transcript.trim()) {
      playBeep('stop');
      processVoiceSmart(transcript);
    }
  }, [isListening]);

  const getCategoryInfo = (catName: string) => {
    const cleanCat = catName.toLowerCase();
    const found = CATALOG_DATA.find(c => c.c.toLowerCase().includes(cleanCat));
    if (found) return { name: found.c, color: found.col };
    return { name: "⚪ Varios", color: "#94a3b8" };
  };

  const addItem = (text: string, category?: string) => {
    if (!text.trim()) return;
    const clean = text.trim().charAt(0).toUpperCase() + text.trim().slice(1).toLowerCase();
    const info = category ? getCategoryInfo(category) : { name: "⚪ Varios", color: "#94a3b8" };

    setItems(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      text: clean,
      checked: false,
      catName: info.name,
      catColor: info.color
    }]);
    if (navigator.vibrate) navigator.vibrate(30);
  };

  const processVoiceSmart = async (t: string) => {
    if (!apiKey || apiKey.length < 10) {
      processVoiceBasic(t);
      return;
    }

    setIsProcessing(true);
    try {
      const prompt = `Eres un asistente de lista de la compra. Tu trabajo es extraer TODOS los productos individuales del texto.
      Reglas estrictas:
      1. Si mencionan varios productos (ej: "tomates cebollas lechuga"), separalos en elementos distintos.
      2. Si mencionan una receta, extrae sus ingredientes básicos.
      3. Devuelve SOLO un JSON válido con este formato: {"items": [{"name": "producto", "category": "Categoría"}]}
      Categorías permitidas: Verduras, Frutas, Carne, Pescado, Lácteos, Charcutería, Despensa, Pan, Limpieza, Mascotas, Varios.
      Texto a analizar: "${t}"`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message || "API Error");

      let textResponse = data.candidates[0].content.parts[0].text;
      const result = JSON.parse(textResponse.trim());
      
      if (result.items && Array.isArray(result.items)) {
        result.items.forEach((i: any) => addItem(i.name, i.category));
      } else {
        throw new Error("Formato IA incorrecto");
      }
    } catch (err: any) {
      console.error(err);
      processVoiceBasic(t);
      // Extraemos solo el mensaje de error real para que quepa en la pantalla
      let msg = err.message || "Error desconocido";
      if (msg.includes("API key not valid")) msg = "Llave incorrecta";
      if (msg.includes("Unexpected token")) msg = "La IA se ha confundido al responder";
      setError(`⚠️ IA: ${msg.substring(0, 40)}`);
      setTimeout(() => setError(null), 4000);
    } finally {
      setIsProcessing(false);
      setTranscript('');
    }
  };

  const processVoiceBasic = (t: string) => {
    const rawParts = t.split(/ y |,|\.|\n/i);
    rawParts.forEach(part => {
      const words = part.trim().split(/\s+/);
      if (words.length === 0) return;
      let currentB: string[] = [];
      const conn = ['de', 'con', 'sin', 'para', 'la', 'el', 'en', 'un', 'una', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'del', 'al', 'los', 'las', 'kilo', 'gramos', 'litros', 'paquete', 'bolsa'];
      words.forEach((word, index) => {
        const w = word.toLowerCase();
        if (index === 0) currentB.push(word);
        else {
          if (conn.includes(w) || conn.includes(words[index - 1].toLowerCase()) || w.length <= 2) currentB.push(word);
          else {
            addItem(currentB.join(" "));
            currentB = [word];
          }
        }
      });
      if (currentB.length > 0) addItem(currentB.join(" "));
    });
  };

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
    if (navigator.vibrate) navigator.vibrate(20);
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
  };

  const shareWhatsApp = () => {
    const f = items.filter(i => !i.checked);
    if (f.length === 0) {
      setError("La lista está vacía");
      setTimeout(() => setError(null), 3000);
      return;
    }
    const t = "🛒 *Lista de Los Mandaos de Evi*\n\n" + f.map(i => `• ${i.text}`).join('\n');
    window.open("whatsapp://send?text=" + encodeURIComponent(t), '_blank');
  };

  const nukeCache = () => {
    if (confirm("Esto borrará la caché y reiniciará la app para actualizarla. ¿Continuar?")) {
      localStorage.clear();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for(let reg of regs) reg.unregister();
        });
      }
      window.location.reload();
    }
  };

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.catName]) acc[item.catName] = [];
    acc[item.catName].push(item);
    return acc;
  }, {} as Record<string, ShoppingItem[]>);

  return (
    <div className={`min-h-screen max-w-lg mx-auto relative flex flex-col font-sans ${mode === 'edit' ? 'edit-mode' : 'shop-mode'}`}>
      <header className="p-6 glass-header sticky top-0 z-10 transition-all duration-300">
        <div className="flex items-center justify-between gap-4">
          <button onClick={() => { if(confirm("¿Borrar todo?")) setItems([]); }} className="p-2.5 rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <RefreshCw size={20} strokeWidth={2.5} />
          </button>
          <div className="text-center flex-1 flex items-center justify-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <ShoppingBasket size={18} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Evi<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-500 to-fuchsia-500">Shop</span></h1>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSettings(!showSettings)} className={`p-2.5 rounded-2xl transition-all ${apiKey ? 'text-green-500 bg-green-500/10' : 'text-slate-400 bg-slate-100/50 dark:bg-slate-800/50'}`}>
              <Settings size={20} strokeWidth={2.5} />
            </button>
            {mode === 'edit' && (
              <button onClick={shareWhatsApp} className="p-2.5 rounded-2xl bg-green-500 text-white shadow-lg shadow-green-500/30 transition-transform active:scale-95">
                <Share2 size={20} strokeWidth={2.5} />
              </button>
            )}
            <button onClick={() => setMode(mode === 'edit' ? 'shop' : 'edit')} className={`p-2.5 rounded-2xl transition-all shadow-lg active:scale-95 ${mode === 'edit' ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-violet-500/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
              {mode === 'edit' ? <ShoppingCart size={20} strokeWidth={2.5} /> : <Edit3 size={20} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <section className="absolute inset-0 bg-white/90 dark:bg-[#0B0F19]/95 backdrop-blur-xl z-30 p-8 flex flex-col gap-6 animate-slide-up">
          <div className="flex items-center gap-4 mt-4">
            <div className="p-4 rounded-3xl bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30 text-white">
              <Brain size={32} />
            </div>
            <div>
              <h2 className="text-3xl font-bold">EviShop Pro</h2>
              <p className="text-slate-500 font-medium">Configuración de IA</p>
            </div>
          </div>
          
          <div className="space-y-3 mt-6">
            <label className="text-sm font-bold text-violet-500 uppercase tracking-widest">Llave Gemini (API Key)</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Pega tu llave AIza..." className="w-full p-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl outline-none focus:ring-4 ring-violet-500/20 shadow-sm transition-all" />
          </div>

          <button onClick={nukeCache} className="mt-6 flex items-center justify-center gap-2 p-5 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-3xl font-bold text-sm border border-red-100 dark:border-red-500/20 transition-all active:scale-95">
            <Trash size={20} /> RESTAURAR APLICACIÓN
          </button>

          <div className="mt-auto text-center space-y-6 pb-6">
            <p className="text-xs text-slate-400 font-mono font-medium opacity-50">Core: {APP_VERSION}</p>
            <button onClick={() => setShowSettings(false)} className="w-full py-5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-3xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl shadow-violet-500/30 active:scale-95 transition-all">
              Guardar y Cerrar <Save size={24} />
            </button>
          </div>
        </section>
      )}

      {isCatalogOpen && (
        <section className="absolute inset-x-0 top-20 bottom-0 bg-white dark:bg-slate-900 z-20 p-4 overflow-y-auto pb-48">
          <button onClick={() => setIsCatalogOpen(false)} className="w-full py-3 bg-violet-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2 sticky top-0 z-10 mb-4">
            Cerrar <ChevronDown />
          </button>
          {CATALOG_DATA.map(cat => (
            <div key={cat.c} className="mb-6">
              <h3 className="text-xs font-black text-slate-400 uppercase mb-2">{cat.c}</h3>
              <div className="grid grid-cols-3 gap-2">
                {cat.items.map(i => (
                  <button key={i.n} onClick={() => addItem(i.n)} className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <span className="text-2xl">{i.e}</span>
                    <span className="text-[10px] text-center font-medium">{i.n}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <main className="flex-1 p-6 pb-48 overflow-y-auto">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-6 opacity-40 animate-fade-in">
            <div className="p-8 rounded-full bg-slate-200/50 dark:bg-slate-800/50">
              <ShoppingBasket size={80} strokeWidth={1} />
            </div>
            <p className="text-xl font-medium tracking-tight">Tu cesta está vacía</p>
          </div>
        ) : (
          Object.keys(grouped).sort().map(cat => (
            <div key={cat} className="mb-8 animate-slide-up">
              <h2 className="text-[11px] font-black uppercase tracking-[0.2em] mb-4 pl-4 border-l-4 opacity-80" style={{ borderLeftColor: grouped[cat][0].catColor }}>{cat}</h2>
              <div className="space-y-3">
                {grouped[cat].map(item => (
                  <div key={item.id} onClick={() => toggleItem(item.id)} className={`group flex items-center gap-4 p-4 rounded-3xl glass-panel transition-all duration-300 active:scale-[0.98] ${item.checked ? 'opacity-40 scale-[0.98]' : 'hover:shadow-2xl'}`}>
                    <div className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all duration-300 ${item.checked ? 'bg-slate-400 border-slate-400 scale-90' : 'border-slate-300 dark:border-slate-600'}`}>
                      {item.checked && <CheckCircle size={16} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`flex-1 text-[17px] font-medium transition-all duration-300 ${item.checked ? 'line-through text-slate-500' : ''}`}>{item.text}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {isListening && (
        <div className="fixed inset-0 bg-slate-900/95 z-50 flex items-center justify-center p-8">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-xs text-center flex flex-col items-center gap-4">
            <div className="bg-red-500 p-6 rounded-full animate-pulse shadow-2xl shadow-red-500/50"><Mic size={40} className="text-white" /></div>
            <p className="font-medium text-slate-400 italic">"{transcript || 'Escuchando...'}"</p>
            <button onClick={toggleListening} className="px-8 py-3 bg-red-500 text-white rounded-2xl font-bold">PARAR</button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="fixed inset-0 bg-violet-500/10 backdrop-blur-[1px] z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl flex items-center gap-4">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
            <p className="font-bold text-violet-500">Evi está pensando...</p>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <nav className="fixed bottom-0 inset-x-0 p-6 flex flex-col items-center gap-6 pointer-events-none z-20">
          <div className="w-full max-w-sm flex gap-3 pointer-events-auto">
            <button onClick={() => setIsCatalogOpen(!isCatalogOpen)} className={`p-4 rounded-3xl glass-panel shadow-xl transition-all active:scale-95 ${isCatalogOpen ? 'bg-violet-500 text-white border-violet-500' : 'text-slate-500'}`}>
              <ShoppingCart size={24} />
            </button>
            <div className="flex-1 flex glass-panel rounded-3xl overflow-hidden shadow-xl pl-2">
              <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (addItem(manualInput), setManualInput(''))} placeholder="Añadir producto..." className="flex-1 px-4 bg-transparent outline-none font-medium placeholder:text-slate-400" />
              <button onClick={() => { addItem(manualInput); setManualInput(''); }} className="p-4 bg-slate-100 dark:bg-slate-800 text-violet-500 hover:bg-violet-500 hover:text-white transition-colors">
                <Plus size={24} strokeWidth={3} />
              </button>
            </div>
          </div>
          <button onClick={toggleListening} className={`w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl pointer-events-auto transition-all duration-300 active:scale-90 ${isListening ? 'bg-red-500 shadow-red-500/50 scale-110' : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-violet-500/40 hover:-translate-y-1'}`}>
            <Mic size={32} className="text-white" />
          </button>
        </nav>
      )}

      {error && <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl z-[60]">{error}</div>}
    </div>
  );
};

export default App;
