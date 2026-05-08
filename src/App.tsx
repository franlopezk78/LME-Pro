import React, { useState, useEffect, useRef } from 'react';
import { Share2, RefreshCw, ShoppingBasket, Edit3, ShoppingCart, Plus, Mic, Package, Trash2, CheckCircle, ChevronDown, Settings, Brain, Save } from 'lucide-react';
import type { ShoppingItem } from './types';
import { CATALOG_DATA } from './constants';

const App: React.FC = () => {
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
    localStorage.setItem('lme_gemini_key', apiKey);
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

  // Voice Logic
  useEffect(() => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      const recognition = new SpeechRec();
      recognition.lang = 'es-ES';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
        playBeep('start');
      };

      recognition.onresult = (e: any) => {
        let interim = '', finalS = '';
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) finalS += e.results[i][0].transcript + " ";
          else interim += e.results[i][0].transcript;
        }
        setTranscript(prev => prev + finalS + interim);
      };

      recognition.onend = () => {
        if (isListening) {
          try { recognition.start(); } catch (e) {}
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isListening]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      playBeep('stop');
      if (transcript.trim()) processVoiceSmart(transcript);
    } else {
      recognitionRef.current?.start();
    }
  };

  const getCategoryInfo = (catName: string) => {
    const found = CATALOG_DATA.find(c => c.c.includes(catName));
    if (found) return { name: found.c, color: found.col };
    
    // Fallback search in catalog items
    for (const cat of CATALOG_DATA) {
      if (cat.items.some(item => catName.toLowerCase().includes(item.n.toLowerCase()))) 
        return { name: cat.c, color: cat.col };
    }
    return { name: "⚪ Varios", color: "#94a3b8" };
  };

  const addItem = (text: string, category?: string) => {
    if (!text.trim()) return;
    const clean = text.trim().charAt(0).toUpperCase() + text.trim().slice(1).toLowerCase();
    
    let info;
    if (category) {
      info = getCategoryInfo(category);
    } else {
      // Old school categorization logic as fallback
      const t = clean.toLowerCase();
      info = { name: "⚪ Varios", color: "#94a3b8" };
      for (const cat of CATALOG_DATA) {
        if (cat.items.some(item => t.includes(item.n.toLowerCase()))) {
          info = { name: cat.c, color: cat.col };
          break;
        }
      }
    }

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
    if (!apiKey) {
      // Fallback to basic processing if no API Key
      processVoiceBasic(t);
      return;
    }

    setIsProcessing(true);
    try {
      const prompt = `Eres un asistente de lista de la compra experto. 
      Analiza el siguiente texto dictado por voz y conviértelo en una lista de productos. 
      Si mencionan una receta (ej: tortilla de patatas), añade sus ingredientes básicos.
      Si mencionan cantidades, inclúyelas en el nombre del producto (ej: "2 litros de leche").
      IMPORTANTE: Devuelve EXCLUSIVAMENTE un JSON con este formato: {"items": [{"name": "producto", "category": "Categoría"}]}
      Usa solo estas categorías: ${CATALOG_DATA.map(c => c.c.split(' ')[1]).join(', ')}, Varios.
      Texto: "${t}"`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: "application/json" }
        })
      });

      const data = await response.json();
      const result = JSON.parse(data.candidates[0].content.parts[0].text);
      
      if (result.items) {
        result.items.forEach((i: any) => addItem(i.name, i.category));
      }
    } catch (err) {
      console.error(err);
      processVoiceBasic(t); // Fallback
      setError("Error con la IA. Usando modo básico.");
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsProcessing(false);
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

  const resetAll = () => {
    if (window.confirm("¿Borrar toda la lista?")) {
      setItems([]);
      if (mode === 'shop') setMode('edit');
    }
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

  // Grouping
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.catName]) acc[item.catName] = [];
    acc[item.catName].push(item);
    return acc;
  }, {} as Record<string, ShoppingItem[]>);

  const sortedCats = Object.keys(grouped).sort();

  return (
    <div className={`min-h-screen max-w-lg mx-auto relative flex flex-col bg-slate-50 dark:bg-slate-900 ${mode === 'edit' ? 'edit-mode' : 'shop-mode'}`}>
      {/* Header */}
      <header className="p-6 bg-white dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 backdrop-blur-md sticky top-0 z-10">
        <div className="grid grid-cols-[40px_1fr_120px] items-center gap-4">
          <button onClick={resetAll} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500">
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
            <button 
              onClick={() => setMode(mode === 'edit' ? 'shop' : 'edit')}
              className={`p-2 rounded-xl ${mode === 'edit' ? 'bg-violet-500' : 'bg-slate-200 dark:bg-slate-700'} text-white`}
            >
              {mode === 'edit' ? <ShoppingBasket size={20} /> : <Edit3 size={20} className="text-slate-500" />}
            </button>
          </div>
        </div>
        
        {mode === 'shop' && (
          <div className="mt-4 flex justify-between items-center p-3 bg-violet-50 dark:bg-violet-900/20 rounded-xl">
            <p className="text-sm font-semibold">{items.filter(i => i.checked).length} de {items.length} comprados</p>
            {items.length > 0 && items.every(i => i.checked) && (
              <button 
                onClick={() => setItems(items.filter(i => !i.checked))}
                className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm font-bold"
              >
                SACABÓ <CheckCircle size={16} />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Settings Overlay */}
      {showSettings && (
        <section className="absolute inset-0 bg-white dark:bg-slate-900 z-30 p-8 flex flex-col gap-6 animate-slide-in">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-violet-500 rounded-2xl text-white">
              <Brain size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Configuración IA</h2>
              <p className="text-slate-500 text-sm">Activa el cerebro de Evi</p>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-400 uppercase">Google Gemini API Key</label>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Pega tu llave AIza..."
              className="w-full p-4 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl outline-none focus:ring-2 ring-violet-500"
            />
          </div>

          <p className="text-xs text-slate-500 leading-relaxed">
            Esta llave se guarda solo en tu móvil. Activa el reconocimiento inteligente, comprensión de recetas y auto-categorización.
          </p>

          <button 
            onClick={() => setShowSettings(false)}
            className="mt-auto py-4 bg-violet-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
          >
            Guardar y Volver <Save size={20} />
          </button>
        </section>
      )}

      {/* Catalog Overlay */}
      {isCatalogOpen && (
        <section className="absolute inset-x-0 top-20 bottom-0 bg-white dark:bg-slate-900 z-20 p-4 overflow-y-auto animate-slide-in pb-48">
          <div className="sticky top-0 bg-inherit pb-4 z-10 border-b border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setIsCatalogOpen(false)}
              className="w-full py-3 bg-violet-500 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
            >
              Cerrar Catálogo <ChevronDown />
            </button>
          </div>
          {CATALOG_DATA.map(cat => (
            <div key={cat.c}>
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mt-6 mb-3">{cat.c}</h3>
              <div className="grid grid-cols-3 gap-2">
                {cat.items.map(item => (
                  <button 
                    key={item.n}
                    onClick={() => addItem(item.n)}
                    className="flex flex-col items-center gap-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 active:scale-95 transition-transform"
                  >
                    <span className="text-2xl">{item.e}</span>
                    <span className="text-[10px] font-medium leading-tight text-center">{item.n}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Main List */}
      <main className="flex-1 p-6 pb-48 overflow-y-auto">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-4 opacity-50">
            <Package size={60} />
            <p className="font-medium text-lg">Tu lista está vacía</p>
          </div>
        ) : (
          <div>
            {sortedCats.map(cat => (
              <div key={cat} className="mb-6">
                <h2 
                  className="text-[10px] font-black uppercase tracking-widest mb-3 pl-3 border-l-4"
                  style={{ borderLeftColor: grouped[cat][0].catColor }}
                >
                  {cat}
                </h2>
                <div className="space-y-3">
                  {grouped[cat].map(item => (
                    <div 
                      key={item.id}
                      onClick={() => toggleItem(item.id)}
                      className={`flex items-center gap-4 p-4 rounded-3xl border-l-4 bg-white dark:bg-slate-800/50 shadow-sm transition-all active:scale-[0.98] ${item.checked ? 'opacity-40 line-through' : ''}`}
                      style={{ borderLeftColor: item.checked ? '#94a3b8' : item.catColor }}
                    >
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${item.checked ? 'bg-slate-400 border-slate-400' : 'border-slate-300'}`}>
                        {item.checked && <div className="w-2 h-4 border-white border-b-2 border-r-2 rotate-45 mb-1" />}
                      </div>
                      <span className="flex-1 text-lg font-medium">{item.text}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        className="p-2 text-red-400 opacity-50 hover:opacity-100"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Voice Overlay */}
      {isListening && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-50 flex items-center justify-center p-8">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 w-full max-w-xs text-center flex flex-col items-center gap-6">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 rounded-full animate-ping opacity-25" />
              <div className="bg-violet-500 p-6 rounded-full relative">
                <Mic size={40} className="text-white" />
              </div>
            </div>
            <p className="font-medium text-slate-500 min-h-[3rem] italic">
              {transcript || 'Te escucho...'}
            </p>
            <button 
              onClick={toggleListening}
              className="px-8 py-3 bg-slate-200 dark:bg-slate-700 rounded-2xl font-bold"
            >
              Terminar
            </button>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-violet-500/20 backdrop-blur-[2px] z-40 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl flex items-center gap-4">
            <div className="w-6 h-6 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-violet-500">Evi está pensando...</p>
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      {mode === 'edit' && (
        <nav className="fixed bottom-0 inset-x-0 p-6 bg-gradient-to-t from-slate-50 dark:from-slate-900 via-slate-50 dark:via-slate-900 to-transparent flex flex-col items-center gap-4 pointer-events-none">
          <div className="w-full flex gap-3 pointer-events-auto">
            <button 
              onClick={() => setIsCatalogOpen(!isCatalogOpen)}
              className={`p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg ${isCatalogOpen ? 'bg-violet-500 text-white' : ''}`}
            >
              <ShoppingCart size={24} />
            </button>
            <div className="flex-1 flex bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-lg">
              <input 
                type="text" 
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (addItem(manualInput), setManualInput(''))}
                placeholder="¿Qué compramos hoy?"
                className="flex-1 px-4 bg-transparent outline-none"
              />
              <button 
                onClick={() => { addItem(manualInput); setManualInput(''); }}
                className="p-4 bg-violet-500 text-white"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>
          <button 
            onClick={toggleListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl pointer-events-auto transition-all active:scale-90 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-violet-500'}`}
          >
            <Mic size={32} className="text-white" />
          </button>
        </nav>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-2xl font-bold shadow-2xl z-[60] animate-bounce">
          {error}
        </div>
      )}
    </div>
  );
};

export default App;
