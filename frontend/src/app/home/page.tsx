"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  FlaskConical,
  ArrowDown,
  Github,
  Copy,
  Check,
  Terminal,
  Settings,
  FileText,
  MessageSquare,
  FolderKanban,
  GitCompareArrows,
  Key,
  ChevronRight,
  Zap,
  ExternalLink
} from "lucide-react";

const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group bauhaus-border shadow-[6px_6px_0_#0a0a14] bg-[#0a0a14] text-white my-4 p-4 font-mono text-sm">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-2 bg-[#0a0a14] text-white border-2 border-white/20 hover:border-white transition-colors"
        title="Copy code"
      >
        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
      </button>
      <pre className="overflow-x-auto whitespace-pre-wrap pr-10">
        <code>{code}</code>
      </pre>
    </div>
  );
};

export default function Home() {
  const scrollToQuickstart = () => {
    document.getElementById("quickstart")?.scrollIntoView({ behavior: "smooth" });
  };

  const features = [
    {
      title: "Projects",
      icon: FolderKanban,
      color: "bg-bauhaus-yellow",
      tag: "ORGANIZATION",
      desc: "Organize evaluations by project. Keep configs, documents, and runs grouped."
    },
    {
      title: "Documents",
      icon: FileText,
      color: "bg-bauhaus-blue",
      tag: "KNOWLEDGE",
      desc: "Upload PDFs and text files. Chunk, embed and index into Qdrant vector store."
    },
    {
      title: "Chat",
      icon: MessageSquare,
      color: "bg-bauhaus-red",
      tag: "INTERACTIVE",
      desc: "Chat with your indexed documents. Test retrieval quality interactively."
    },
    {
      title: "Evaluate",
      icon: FlaskConical,
      color: "bg-bauhaus-yellow",
      tag: "METRICS",
      desc: "Run evaluation with RAGAS metrics: faithfulness, answer relevancy, contextual precision & recall."
    },
    {
      title: "Compare",
      icon: GitCompareArrows,
      color: "bg-bauhaus-blue",
      tag: "INSIGHTS",
      desc: "Radar chart comparison of two eval runs. See which config wins on each metric."
    },
    {
      title: "Pipeline Config",
      icon: Settings,
      color: "bg-bauhaus-red",
      tag: "TUNING",
      desc: "Tune chunking, retrieval mode, LLM model, and embedding model. Enter your API key in settings."
    }
  ];

  return (
    <div className="min-h-screen bg-[#fafaf9] bauhaus-grid-bg text-[#0a0a14] font-sans selection:bg-bauhaus-yellow selection:text-[#0a0a14]">
      {/* 1. TOP NAV BAR */}
      <nav className="sticky top-0 z-50 bg-[#0a0a14] border-b-[3px] border-bauhaus-yellow h-14 flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-bauhaus-red border-2 border-white flex items-center justify-center">
            <FlaskConical size={18} className="text-white" />
          </div>
          <div className="font-black uppercase tracking-widest text-lg flex">
            <span className="text-bauhaus-yellow">RAG</span>
            <span className="text-white">BENCH</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/paramjeetn/RagBench"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 text-white hover:text-bauhaus-yellow transition-colors font-bold uppercase text-sm tracking-wide"
          >
            <Github size={18} />
            Star on GitHub
          </a>
          <Link
            href="/dashboard"
            className="bg-bauhaus-red text-white border-2 border-white px-4 py-1.5 font-black uppercase text-sm tracking-widest hover:bg-white hover:text-bauhaus-red transition-colors"
          >
            Open App
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-20 flex flex-col gap-24">
        
        {/* 2. HERO SECTION */}
        <section className="flex flex-col items-center justify-center text-center mt-10 md:mt-20 relative">
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="relative mb-8 flex items-center justify-center"
          >
            <div className="w-32 h-32 bg-bauhaus-yellow bauhaus-border shadow-[6px_6px_0_#0a0a14] absolute" />
            <div className="w-28 h-28 bg-bauhaus-red rounded-full bauhaus-border shadow-[6px_6px_0_#0a0a14] absolute z-10 flex items-center justify-center">
              <FlaskConical size={48} className="text-[#0a0a14]" strokeWidth={2.5} />
            </div>
            <div className="w-0 h-0 border-l-[30px] border-l-transparent border-b-[50px] border-b-bauhaus-blue border-r-[30px] border-r-transparent absolute -right-8 -top-8 rotate-12 z-0 filter drop-shadow-[4px_4px_0_#0a0a14]" />
          </motion.div>

          <h1 className="text-6xl md:text-8xl font-black uppercase tracking-widest mb-4 flex gap-4 mt-10">
            <span className="text-bauhaus-red drop-shadow-[4px_4px_0_#0a0a14]">RAG</span>
            <span className="text-bauhaus-blue drop-shadow-[4px_4px_0_#0a0a14]">BENCH</span>
          </h1>
          
          <p className="text-xl md:text-2xl font-bold uppercase tracking-wider text-[#0a0a14]/70 mb-10 max-w-2xl">
            Evaluate · Compare · Improve your RAG pipeline
          </p>

          <div className="flex flex-col sm:flex-row gap-6 mb-12">
            <button
              onClick={scrollToQuickstart}
              className="bg-bauhaus-red text-white text-lg px-8 py-4 bauhaus-border shadow-[6px_6px_0_#0a0a14] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[4px_4px_0_#0a0a14] transition-all active:translate-y-[6px] active:translate-x-[6px] active:shadow-none"
            >
              Get Started <ArrowDown size={24} />
            </button>
            <a
              href="https://github.com/paramjeetn/RagBench"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-transparent text-[#0a0a14] text-lg px-8 py-4 bauhaus-border shadow-[6px_6px_0_#0a0a14] font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-[#0a0a14] hover:text-white transition-all hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[4px_4px_0_#0a0a14] active:translate-y-[6px] active:translate-x-[6px] active:shadow-none bg-white"
            >
              <Github size={24} /> View on GitHub
            </a>
          </div>

          <div className="flex items-center gap-6 mt-8">
            <div className="flex gap-2">
              <div className="w-4 h-4 rounded-full bg-bauhaus-red border-2 border-[#0a0a14]"></div>
              <div className="w-4 h-4 bg-bauhaus-yellow border-2 border-[#0a0a14]"></div>
              <div className="w-4 h-4 rounded-full bg-bauhaus-blue border-2 border-[#0a0a14]"></div>
            </div>
            <div className="text-sm font-bold tracking-widest uppercase border-2 border-[#0a0a14] px-3 py-1 bg-white">
              MIT License · Open Source · Free
            </div>
          </div>
        </section>

        {/* 3. FEATURE SHOWCASE */}
        <section className="mt-10">
          <div className="mb-10 inline-block relative">
            <div className="absolute inset-x-0 bottom-1 h-4 bg-bauhaus-yellow -z-10"></div>
            <h2 className="text-4xl font-black uppercase tracking-widest z-10">What You Get</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: index * 0.08, duration: 0.4 }}
                className="bauhaus-card bg-white flex flex-col h-full"
              >
                <div className={`h-3 w-full ${feature.color} border-b-[3px] border-[#0a0a14]`} />
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-4">
                    <div className={`w-12 h-12 ${feature.color} bauhaus-border flex items-center justify-center shadow-[4px_4px_0_#0a0a14]`}>
                      <feature.icon size={24} className="text-[#0a0a14]" strokeWidth={2.5} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest px-2 py-1 bg-[#0a0a14] text-white">
                      {feature.tag}
                    </span>
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-widest mb-3">{feature.title}</h3>
                  <p className="font-medium leading-relaxed text-[#0a0a14]/80 flex-grow">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 4. QUICK START SECTION */}
        <section id="quickstart" className="scroll-mt-24">
          <div className="mb-12 inline-block relative">
            <div className="absolute inset-x-0 bottom-1 h-4 bg-bauhaus-red -z-10"></div>
            <h2 className="text-4xl font-black uppercase tracking-widest z-10">Quick Start</h2>
            <p className="font-bold tracking-widest uppercase mt-4 text-[#0a0a14]/60">Up and running in 3 steps</p>
          </div>

          <div className="flex flex-col gap-12">
            {/* Step 1 */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-16 h-16 shrink-0 bg-bauhaus-yellow bauhaus-border shadow-[6px_6px_0_#0a0a14] flex items-center justify-center text-2xl font-black">
                01
              </div>
              <div className="flex-grow pt-2">
                <h3 className="text-2xl font-black uppercase tracking-widest mb-3">Install Docker</h3>
                <p className="font-medium text-lg mb-4">
                  Docker Desktop is the only requirement. No Python, no Node — Docker handles everything.
                </p>
                <a
                  href="https://docs.docker.com/get-started/get-docker/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-transparent text-[#0a0a14] font-black uppercase tracking-widest border-[3px] border-[#0a0a14] px-6 py-3 hover:bg-bauhaus-yellow transition-colors shadow-[4px_4px_0_#0a0a14] hover:shadow-[2px_2px_0_#0a0a14] hover:translate-y-[2px] hover:translate-x-[2px]"
                >
                  Get Docker Desktop <ExternalLink size={18} />
                </a>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-16 h-16 shrink-0 bg-bauhaus-blue text-white bauhaus-border shadow-[6px_6px_0_#0a0a14] flex items-center justify-center text-2xl font-black">
                02
              </div>
              <div className="flex-grow pt-2 w-full max-w-3xl">
                <h3 className="text-2xl font-black uppercase tracking-widest mb-3">Clone & Configure</h3>
                <p className="font-medium text-lg mb-2">
                  Clone the repo and copy the example env file. Add at least one LLM API key.
                </p>
                <CodeBlock code={`git clone https://github.com/paramjeetn/RagBench\ncd RagBench\ncp .env.example .env`} />
                
                <p className="font-bold text-sm bg-white p-3 border-l-4 border-bauhaus-yellow inline-block my-2">
                  Then open .env and add your API key (Gemini is free at aistudio.google.com)
                </p>
                
                <div className="flex flex-wrap gap-3 mt-4">
                  <span className="text-xs font-black px-3 py-1 bg-[#10b981] text-white uppercase tracking-widest border-2 border-[#0a0a14]">
                    Gemini (Free)
                  </span>
                  <span className="text-xs font-black px-3 py-1 bg-[#3b82f6] text-white uppercase tracking-widest border-2 border-[#0a0a14]">
                    OpenAI
                  </span>
                  <span className="text-xs font-black px-3 py-1 bg-[#8b5cf6] text-white uppercase tracking-widest border-2 border-[#0a0a14]">
                    Anthropic
                  </span>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="w-16 h-16 shrink-0 bg-bauhaus-red text-white bauhaus-border shadow-[6px_6px_0_#0a0a14] flex items-center justify-center text-2xl font-black">
                03
              </div>
              <div className="flex-grow pt-2 w-full max-w-3xl">
                <h3 className="text-2xl font-black uppercase tracking-widest mb-3">Launch</h3>
                <p className="font-medium text-lg mb-2">
                  One command starts everything: Postgres, Qdrant, backend, and frontend.
                </p>
                <CodeBlock code={`make up`} />
                <p className="font-bold text-sm mb-4">
                  Then open <a href="http://localhost:3000" className="text-bauhaus-blue underline">localhost:3000</a> in your browser
                </p>
                
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold bg-[#16a34a]/10 p-4 border-[3px] border-[#16a34a]">
                  <span className="flex items-center gap-2 text-[#166534]"><Check size={16} strokeWidth={3} /> Backend on :8000</span>
                  <span className="flex items-center gap-2 text-[#166534]"><Check size={16} strokeWidth={3} /> Frontend on :3000</span>
                  <span className="flex items-center gap-2 text-[#166534]"><Check size={16} strokeWidth={3} /> Postgres on :5432</span>
                  <span className="flex items-center gap-2 text-[#166534]"><Check size={16} strokeWidth={3} /> Qdrant on :6333</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. PIPELINE SETTINGS CALLOUT */}
        <section>
          <div className="bg-[#fef3c7] border-l-[8px] border-bauhaus-yellow p-6 md:p-10 bauhaus-border shadow-[8px_8px_0_#0a0a14] relative overflow-hidden">
            <div className="absolute -right-10 -bottom-10 text-bauhaus-yellow opacity-20">
              <Settings size={200} strokeWidth={1} />
            </div>
            
            <div className="relative z-10 flex flex-col lg:flex-row gap-8">
              <div className="flex-1">
                <h3 className="text-2xl font-black uppercase tracking-widest mb-4 flex items-center gap-3">
                  <Key className="text-bauhaus-red" size={28} />
                  API Keys & Pipeline Config
                </h3>
                <p className="font-medium text-lg leading-relaxed mb-6 bg-white/50 p-4 border-2 border-[#0a0a14]/10">
                  Once the app is running, click <strong className="font-black">Pipeline Settings</strong> in the sidebar to configure your LLM, embedding model, and enter API keys. Keys are stored in your browser — never on any server.
                </p>
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-2 bg-bauhaus-blue text-white font-black uppercase tracking-widest px-6 py-3 border-[3px] border-[#0a0a14] shadow-[4px_4px_0_#0a0a14] hover:translate-y-[2px] hover:translate-x-[2px] hover:shadow-[2px_2px_0_#0a0a14] transition-all"
                >
                  <Settings size={18} /> Open Settings
                </Link>
              </div>
              
              <div className="flex-1 bg-white p-6 border-[3px] border-[#0a0a14]">
                <ul className="space-y-4 font-bold text-sm">
                  <li className="flex items-start gap-3">
                    <span className="text-xl">⚙</span>
                    <div>
                      <span className="uppercase tracking-wider">Chunking strategy</span>
                      <div className="text-gray-500 font-medium">recursive / fixed / semantic</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-xl">🔍</span>
                    <div>
                      <span className="uppercase tracking-wider">Retrieval mode</span>
                      <div className="text-gray-500 font-medium">hybrid / dense / sparse</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-xl">🤖</span>
                    <div>
                      <span className="uppercase tracking-wider">LLM model</span>
                      <div className="text-gray-500 font-medium">Gemini · OpenAI · Anthropic · Ollama</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-xl">📐</span>
                    <div>
                      <span className="uppercase tracking-wider">Embedding model</span>
                      <div className="text-gray-500 font-medium">local fastembed, OpenAI, Gemini</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="text-xl">🔑</span>
                    <div>
                      <span className="uppercase tracking-wider">API keys</span>
                      <div className="text-gray-500 font-medium">browser-only, never stored on server</div>
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 6. MAKEFILE COMMANDS REFERENCE */}
        <section>
          <div className="mb-8 inline-block relative">
            <div className="absolute inset-x-0 bottom-1 h-4 bg-bauhaus-blue -z-10"></div>
            <h2 className="text-3xl font-black uppercase tracking-widest z-10 flex items-center gap-3">
              <Terminal size={32} /> Useful Commands
            </h2>
          </div>

          <div className="bg-[#0a0a14] text-white p-6 md:p-8 bauhaus-border shadow-[6px_6px_0_#2563EB] font-mono overflow-x-auto">
            <table className="w-full text-left min-w-[500px]">
              <tbody className="space-y-2">
                <tr className="border-b border-white/10">
                  <td className="py-3 px-4 w-48 font-bold"><span className="text-bauhaus-yellow mr-2">$</span>make up</td>
                  <td className="py-3 px-4 text-white/60"># Start all services</td>
                </tr>
                <tr className="border-b border-white/10 bg-white/5">
                  <td className="py-3 px-4 font-bold"><span className="text-bauhaus-yellow mr-2">$</span>make down</td>
                  <td className="py-3 px-4 text-white/60"># Stop all services</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-3 px-4 font-bold"><span className="text-bauhaus-yellow mr-2">$</span>make logs</td>
                  <td className="py-3 px-4 text-white/60"># Tail all logs</td>
                </tr>
                <tr className="border-b border-white/10 bg-white/5">
                  <td className="py-3 px-4 font-bold"><span className="text-bauhaus-yellow mr-2">$</span>make logs-backend</td>
                  <td className="py-3 px-4 text-white/60"># Backend logs only</td>
                </tr>
                <tr className="border-b border-white/10">
                  <td className="py-3 px-4 font-bold"><span className="text-bauhaus-yellow mr-2">$</span>make clean-data</td>
                  <td className="py-3 px-4 text-white/60"># Wipe DB + Qdrant (fresh start)</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-bold"><span className="text-bauhaus-yellow mr-2">$</span>make clean-slate</td>
                  <td className="py-3 px-4 text-white/60"># Full rebuild from scratch</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* 7. FOOTER */}
      <footer className="bg-[#0a0a14] text-white py-8 border-t-[3px] border-[#0a0a14]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <FlaskConical size={20} className="text-bauhaus-red" />
              <span className="font-black uppercase tracking-widest">RagBench</span>
            </div>
            <span className="text-white/40">|</span>
            <span className="text-xs font-bold uppercase tracking-widest text-white/60">MIT License</span>
          </div>

          <div className="flex gap-3">
            <div className="w-3 h-3 rounded-full bg-bauhaus-red"></div>
            <div className="w-3 h-3 bg-bauhaus-yellow"></div>
            <div className="w-3 h-3 rounded-full bg-bauhaus-blue"></div>
          </div>

          <div className="flex items-center gap-4 text-sm font-bold tracking-widest uppercase">
            <span className="text-white/60 hidden sm:inline">Built with Bauhaus precision</span>
            <a
              href="https://github.com/paramjeetn/RagBench"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-bauhaus-yellow hover:text-white transition-colors"
            >
              <Github size={16} /> GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
