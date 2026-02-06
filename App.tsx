
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, DocumentChunk, KnowledgeBase } from './types';
import { DocumentProcessor } from './services/documentProcessor';
import { GeminiService } from './services/geminiService';
import { 
  PlusIcon, 
  SendHorizontalIcon, 
  FileTextIcon, 
  TableIcon, 
  Trash2Icon, 
  BotIcon, 
  UserIcon,
  Loader2Icon,
  DatabaseIcon,
  SearchIcon,
  InfoIcon
} from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase>({ chunks: [], fileNames: [] });
  const [isProcessing, setIsProcessing] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const geminiRef = useRef<GeminiService | null>(null);

  useEffect(() => {
    geminiRef.current = new GeminiService();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    try {
      const allNewChunks: DocumentChunk[] = [];
      const newFileNames: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (knowledgeBase.fileNames.includes(file.name)) continue;
        
        const chunks = await DocumentProcessor.processFile(file);
        allNewChunks.push(...chunks);
        newFileNames.push(file.name);
      }

      setKnowledgeBase(prev => ({
        chunks: [...prev.chunks, ...allNewChunks],
        fileNames: [...prev.fileNames, ...newFileNames]
      }));
    } catch (error) {
      console.error("File processing error:", error);
      alert("Error processing files. Please check file formats.");
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const clearKnowledgeBase = () => {
    setKnowledgeBase({ chunks: [], fileNames: [] });
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const relevantChunks = DocumentProcessor.findRelevantChunks(
        inputText, 
        knowledgeBase.chunks
      );

      const responseText = await geminiRef.current!.generateResponse(
        inputText,
        messages.slice(-5), // Context history
        relevantChunks
      );

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: Date.now(),
        sources: Array.from(new Set(relevantChunks.map(c => c.fileName)))
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'system',
        content: "Oops! Something went wrong while generating the response.",
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950">
      {/* Sidebar */}
      <aside className="w-80 flex-shrink-0 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
        <div className="p-6 border-b border-zinc-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/20">
            <DatabaseIcon className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-zinc-100">Gemini RAG</h1>
            <p className="text-xs text-zinc-500">Document Brain</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
            <div className="flex items-center justify-between mb-3 px-2">
              <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Knowledge Base</h2>
              {knowledgeBase.fileNames.length > 0 && (
                <button 
                  onClick={clearKnowledgeBase}
                  className="p-1 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-red-400 transition-colors"
                >
                  <Trash2Icon size={14} />
                </button>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-700 rounded-xl hover:bg-zinc-800/50 hover:border-zinc-500 cursor-pointer transition-all group">
                <div className="flex flex-col items-center justify-center pt-2">
                  {isProcessing ? (
                    <Loader2Icon className="w-6 h-6 text-blue-500 animate-spin" />
                  ) : (
                    <PlusIcon className="w-6 h-6 text-zinc-500 group-hover:text-blue-400" />
                  )}
                  <p className="mt-2 text-xs text-zinc-500 group-hover:text-zinc-300">
                    {isProcessing ? 'Processing...' : 'Upload PDF/CSV'}
                  </p>
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  multiple 
                  accept=".pdf,.csv"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
              </label>

              {knowledgeBase.fileNames.map(name => (
                <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/30 border border-zinc-700/50">
                  {name.endsWith('.pdf') ? (
                    <FileTextIcon className="text-blue-400" size={16} />
                  ) : (
                    <TableIcon className="text-green-400" size={16} />
                  )}
                  <span className="text-xs truncate text-zinc-300 font-medium">{name}</span>
                </div>
              ))}

              {knowledgeBase.fileNames.length === 0 && !isProcessing && (
                <div className="text-center py-4 px-2">
                  <InfoIcon className="mx-auto w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-[11px] text-zinc-600">
                    Your indexed files will appear here. Add documents to contextually chat with them.
                  </p>
                </div>
              )}
            </div>
          </section>

          {knowledgeBase.chunks.length > 0 && (
            <section className="bg-blue-900/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2 text-blue-400">
                <SearchIcon size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">Index Ready</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                We've indexed <span className="text-blue-300 font-bold">{knowledgeBase.chunks.length}</span> snippets.
                Ask questions about your data for precise answers.
              </p>
            </section>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="p-3 bg-zinc-950 rounded-lg flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Gemini 3 Flash Connected</span>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-zinc-950">
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 flex items-center px-8 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex-1">
             <h2 className="text-sm font-semibold text-zinc-300">Analysis Session</h2>
             <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Retrieval Augmented Generation</p>
          </div>
        </header>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-8 scroll-smooth"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-6">
              <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800 shadow-2xl">
                <BotIcon className="text-blue-500 w-10 h-10" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-100">Ready to analyze your data</h3>
                <p className="text-zinc-500 mt-2 text-sm">
                  Upload PDF reports, technical docs, or CSV spreadsheets to start a data-driven conversation. I'll search through them to give you grounded answers.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                {["Ringkas temuan utama", "Temukan nilai spesifik", "Bandingkan dokumen", "Ekstrak wawasan"].map(t => (
                  <button 
                    key={t}
                    onClick={() => setInputText(t)}
                    className="p-3 text-[11px] font-medium text-zinc-400 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:text-zinc-200 transition-all bg-zinc-900/30 text-left"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex gap-6 ${m.role === 'user' ? 'justify-end' : ''}`}>
                {m.role !== 'user' && (
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex-shrink-0 flex items-center justify-center mt-1">
                    {m.role === 'assistant' ? <BotIcon className="text-blue-400" size={20} /> : <InfoIcon className="text-zinc-500" size={20} />}
                  </div>
                )}
                
                <div className={`max-w-[80%] ${m.role === 'user' ? 'text-right' : ''}`}>
                  <div className={`inline-block px-5 py-3 rounded-2xl ${
                    m.role === 'user' 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                      : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                  }`}>
                    <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                  
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 justify-start">
                      {m.sources.map(s => (
                        <span key={s} className="px-2 py-0.5 bg-zinc-800/50 border border-zinc-700/50 rounded-full text-[10px] text-zinc-500 flex items-center gap-1">
                          <FileTextIcon size={10} />
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {m.role === 'user' && (
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex-shrink-0 flex items-center justify-center mt-1 shadow-lg shadow-blue-900/20">
                    <UserIcon className="text-white" size={20} />
                  </div>
                )}
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex gap-6">
              <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex-shrink-0 flex items-center justify-center mt-1">
                <BotIcon className="text-blue-400 animate-pulse" size={20} />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-bounce [animation-delay:-0.3s]"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-8 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto relative">
            <input 
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={knowledgeBase.chunks.length > 0 ? "Ask about your documents..." : "Upload documents to ask contextual questions..."}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl pl-6 pr-14 py-5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 focus:border-blue-600/50 transition-all shadow-2xl"
            />
            <button 
              onClick={handleSendMessage}
              disabled={isLoading || !inputText.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl flex items-center justify-center transition-all shadow-lg"
            >
              {isLoading ? <Loader2Icon className="animate-spin" size={20} /> : <SendHorizontalIcon size={20} />}
            </button>
          </div>
          <p className="text-center text-[10px] text-zinc-600 mt-4 uppercase tracking-widest font-medium">
            AI can make mistakes. Verify important information with source citations.
          </p>
        </div>
      </main>
    </div>
  );
};

export default App;
