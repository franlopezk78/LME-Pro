import React, { useState, useEffect, useRef } from 'react';
import { Share2, RefreshCw, ShoppingBasket, Edit3, ShoppingCart, Plus, Mic, Package, Trash2, CheckCircle, ChevronDown, Settings, Brain, Save, Loader2, Trash } from 'lucide-react';
import type { ShoppingItem } from './types';
import { CATALOG_DATA } from './constants';

const App: React.FC = () => {
  const APP_VERSION = "4.1 - Anti-Loro";
  
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
      1. Si mencionan varios productos (ej: "tomates cebollas lechuga"), debes separarlos en elementos distintos.
      2. Si mencionan una receta, extrae sus ingredientes básicos.
      3. Ignora palabras de relleno ("apunta", "necesito", "compra").
      
      Devuelve SOLO un JSON estricto con este formato: {"items": [{"name": "nombre del producto", "category": "Categoría"}]}
      Categorías permitidas: Verduras, Frutas, Carne, Pescado, Lácteos, Charcutería, Despensa, Pan, Limpieza, Mascotas, Varios.
      Texto a analizar: "${t}"`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      let textResponse = data.candidates[0].content.parts[0].text;
      textResponse = textResponse.replace(/```json|```/g, "").trim();
      const result = JSON.parse(textResponse);
      
      if (result.items) {
        result.items.forEach((i: any) => addItem(i.name, i.category));
      } else {
        processVoiceBasic(t);
      }
    } catch (err) {
      console.error(err);
      processVoiceBasic(t);
      setError("Error IA. Verifica tu llave en ajustes.");
      setTimeout(() => setError(null), 3000);
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
    <div className={`min-h-screen max-w-lg mx-auto relative flex flex-col bg-slate-50 dark:bg-slate-900 ${mode === 'edit' ? 'edit-mode' : 'shop-mode'}`}>
      <header className="p-6 bg-white dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 backdrop-blur-md sticky top-0 z-10">
        <div className="grid grid-cols-[40px_1fr_120px] items-center gap-4">
          <button onClick={() => { if(confirm("¿Borrar todo?")) setItems([]); }} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500">
            <RefreshCw size={20} />
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold">Los Mandaos de <span className="text-violet-500">Evi</span></h1>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-xl ${apiKey ? 'text-green-500' : 'text-slate-400'} bg-slate-100 dark:bg-slate-700`}>
              <Settings size={20} />
            </button>
            {mode === 'edit' && (
              <button onClick={shareWhatsApp} className="p-2 rounded-xl bg-green-500 text-white">
                <Share2 size={20} />
              </button>
            )}
            <button onClick={() => setMode(mode === 'edit' ? 'shop' : 'edit')} className={`p-2 rounded-xl ${mode === 'edit' ? 'bg-violet-500' : 'bg-slate-200 dark:bg-slate-700'} text-white`}>
              {mode === 'edit' ? <ShoppingBasket size={20} /> : <Edit3 size={20} className="text-slate-500" />}
            </button>
          </div>
        </div>
      </header>

      {showSettings && (
        <section className="absolute inset-0 bg-white dark:bg-slate-900 z-30 p-8 flex flex-col gap-6 animate-slide-in">
          <div className="flex items-center gap-4">
            <Brain size={32} className="text-violet-500" />
            <h2 className="text-2xl font-bold">Ajustes Pro</h2>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Google Gemini API Key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AIza..." className="w-full p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl outline-none" />
          </div>

          <button onClick={nukeCache} className="mt-4 flex items-center justify-center gap-2 p-4 bg-red-100 text-red-600 rounded-2xl font-bold text-sm">
            <Trash size={18} /> LIMPIAR CACHÉ Y REINICIAR
          </button>

          <div className="mt-auto text-center space-y-4">
            <p className="text-[10px] text-slate-400 font-mono">Versión: {APP_VERSION}</p>
            <button onClick={() => setShowSettings(false)} className="w-full py-4 bg-violet-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
              Guardar y Cerrar <Save size={20} />
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
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-30">
            <Package size={60} />
            <p className="text-lg">Lista vacía</p>
          </div>
        ) : (
          Object.keys(grouped).sort().map(cat => (
            <div key={cat} className="mb-6 animate-slide-in">
              <h2 className="text-[10px] font-black uppercase tracking-tighter mb-3 pl-3 border-l-4" style={{ borderLeftColor: grouped[cat][0].catColor }}>{cat}</h2>
              <div className="space-y-2">
                {grouped[cat].map(item => (
                  <div key={item.id} onClick={() => toggleItem(item.id)} className={`flex items-center gap-4 p-4 rounded-3xl bg-white dark:bg-slate-800/50 shadow-sm transition-all ${item.checked ? 'opacity-30 line-through' : ''}`}>
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${item.checked ? 'bg-slate-400 border-slate-400' : 'border-slate-200'}`}>
                      {item.checked && <CheckCircle size={14} className="text-white" />}
                    </div>
                    <span className="flex-1 font-medium">{item.text}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }} className="p-2 text-red-300"><Trash2 size={18} /></button>
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
        <nav className="fixed bottom-0 inset-x-0 p-6 flex flex-col items-center gap-4 pointer-events-none">
          <div className="w-full flex gap-3 pointer-events-auto">
            <button onClick={() => setIsCatalogOpen(!isCatalogOpen)} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg text-slate-500"><ShoppingCart size={24} /></button>
            <div className="flex-1 flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-lg">
              <input type="text" value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && (addItem(manualInput), setManualInput(''))} placeholder="¿Qué compramos?" className="flex-1 px-4 bg-transparent outline-none" />
              <button onClick={() => { addItem(manualInput); setManualInput(''); }} className="p-4 bg-violet-500 text-white"><Plus size={24} /></button>
            </div>
          </div>
          <button onClick={toggleListening} className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl pointer-events-auto transition-all ${isListening ? 'bg-red-500' : 'bg-violet-500'}`}><Mic size={32} className="text-white" /></button>
        </nav>
      )}

      {error && <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl z-[60]">{error}</div>}
    </div>
  );
};

export default App;
