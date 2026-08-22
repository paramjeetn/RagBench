"use client";

import { useState } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import {
  FlaskConical,
  Monitor,
  Cloud,
  ArrowRight,
  ExternalLink,
  Github,
  Terminal,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";

export default function LandingPage() {
  const [copied, setCopied] = useState(false);

  const commandText = `git clone https://github.com/paramjeetn/RagBench
cd RagBench
cp .env.example .env   # add your LLM key
make up`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(commandText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API fails
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-background text-foreground overflow-x-hidden selection:bg-[#F4C542] selection:text-[#0a0a14]">
      {/* Bauhaus Grid Background */}
      <div className="pointer-events-none fixed inset-0 bauhaus-grid-bg opacity-100" />

      {/* Decorative Bauhaus Corner & Edge Elements */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {/* Top-right large circle */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full border-[16px] border-[#F4C542] opacity-20" />
        {/* Bottom-left Bauhaus triangle */}
        <div
          className="absolute -bottom-12 -left-12 h-44 w-44 opacity-15"
          style={{
            background: "#2563EB",
            clipPath: "polygon(0 100%, 50% 0, 100% 100%)",
          }}
        />
        {/* Mid-left accent strip */}
        <div className="absolute top-1/3 -left-3 h-28 w-4 bg-[#E63946] opacity-60" />
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        
        {/* ================= HERO SECTION ================= */}
        <div className="flex flex-col items-center justify-center text-center space-y-6 pt-4 pb-8 max-w-4xl mx-auto">
          {/* Giant Bauhaus Geometric Logo */}
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 150, damping: 16 }}
            className="relative"
          >
            {/* Outer yellow square */}
            <div
              className="h-24 w-24 sm:h-28 sm:w-28 flex items-center justify-center"
              style={{
                background: "#F4C542",
                border: "4px solid #0a0a14",
                boxShadow: "8px 8px 0 #E63946",
                borderRadius: 0,
              }}
            >
              {/* Inner red circle */}
              <div
                className="h-14 w-14 sm:h-16 sm:w-16 flex items-center justify-center rounded-full"
                style={{ background: "#E63946" }}
              >
                <FlaskConical className="h-7 w-7 sm:h-8 sm:w-8 text-white" />
              </div>
            </div>
            {/* Blue triangle accent (bottom-right) */}
            <div
              className="absolute -bottom-3 -right-3 sm:-bottom-4 sm:-right-4 h-7 w-7 sm:h-8 sm:w-8"
              style={{
                background: "#2563EB",
                clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)",
              }}
            />
          </motion.div>

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="space-y-2"
          >
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black uppercase tracking-tight text-foreground">
              <span style={{ color: "#E63946" }}>RAG</span>
              <span style={{ color: "#2563EB" }}>BENCH</span>
            </h1>
            <p className="text-sm sm:text-base font-medium tracking-wide text-muted-foreground max-w-xl mx-auto">
              Evaluate · Compare · Improve RAG Pipelines
            </p>
          </motion.div>

          {/* Bauhaus Colored Dots Row */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.3 }}
            className="flex items-center gap-3 pt-1"
          >
            <div
              className="h-4 w-4 rounded-full"
              style={{ background: "#E63946", border: "2px solid #0a0a14" }}
            />
            <div
              className="h-4 w-4"
              style={{ background: "#F4C542", border: "2px solid #0a0a14" }}
            />
            <div
              className="h-4 w-4 rounded-full"
              style={{ background: "#2563EB", border: "2px solid #0a0a14" }}
            />
          </motion.div>
        </div>

        {/* ================= TWO OPTION CARDS ================= */}
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch pb-12">
          
          {/* Card 1 — RUN LOCALLY */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="flex flex-col justify-between bg-card text-card-foreground relative"
            style={{
              border: "3px solid #0a0a14",
              boxShadow: "8px 8px 0 #0a0a14",
              borderRadius: 0,
            }}
          >
            {/* Top Thick Color Bar */}
            <div className="h-3 w-full bg-[#0a0a14]" />

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                {/* Header Row: Badge & Icon */}
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="h-14 w-14 flex items-center justify-center text-white"
                    style={{
                      background: "#E63946",
                      border: "3px solid #0a0a14",
                      boxShadow: "4px 4px 0 #0a0a14",
                      borderRadius: 0,
                    }}
                  >
                    <Monitor className="h-7 w-7" />
                  </div>

                  <span
                    className="px-3 py-1 text-xs font-black uppercase tracking-widest"
                    style={{
                      background: "#F4C542",
                      color: "#0a0a14",
                      border: "2px solid #0a0a14",
                      borderRadius: 0,
                    }}
                  >
                    NO LIMITS
                  </span>
                </div>

                {/* Title & Subtitle */}
                <div className="mt-5">
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground">
                    RUN LOCALLY
                  </h2>
                  <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground mt-1">
                    Full power. No restrictions.
                  </p>
                </div>

                {/* Divider */}
                <div
                  className="my-5"
                  style={{ height: "2px", background: "#0a0a14" }}
                />

                {/* Feature Bullets */}
                <ul className="space-y-2.5 text-sm font-bold text-foreground">
                  <li className="flex items-center gap-2.5">
                    <span style={{ color: "#E63946" }}>■</span>
                    <span>Unlimited file uploads</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span style={{ color: "#F4C542" }}>■</span>
                    <span>Local Qdrant vector store</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span style={{ color: "#2563EB" }}>■</span>
                    <span>All embedding models</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span style={{ color: "#E63946" }}>■</span>
                    <span>Ollama support (no API key)</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span style={{ color: "#2563EB" }}>■</span>
                    <span>Your data stays on your machine</span>
                  </li>
                </ul>

                {/* Monospace Command Block */}
                <div
                  className="mt-6 p-4 text-white relative"
                  style={{
                    background: "#0a0a14",
                    border: "2px solid #0a0a14",
                    borderRadius: 0,
                  }}
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-700">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-zinc-400">
                      <Terminal className="h-3.5 w-3.5 text-[#F4C542]" />
                      <span>TERMINAL</span>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider transition-all"
                      style={{
                        background: copied ? "#F4C542" : "transparent",
                        color: copied ? "#0a0a14" : "#ffffff",
                        border: "1px solid #ffffff",
                        borderRadius: 0,
                      }}
                      title="Copy commands"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>COPY</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="font-mono text-xs leading-relaxed overflow-x-auto text-zinc-200">
                    <code>
                      <span className="text-[#F4C542]">$ </span>git clone https://github.com/paramjeetn/RagBench{"\n"}
                      <span className="text-[#F4C542]">$ </span>cd RagBench{"\n"}
                      <span className="text-[#F4C542]">$ </span>cp .env.example .env <span className="text-zinc-500"># add your LLM key</span>{"\n"}
                      <span className="text-[#F4C542]">$ </span>make up
                    </code>
                  </pre>
                </div>
              </div>

              {/* Action Button & Note */}
              <div className="mt-8 pt-4">
                <a
                  href="https://github.com/paramjeetn/RagBench"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 text-sm font-black uppercase tracking-widest text-white transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                  style={{
                    background: "#E63946",
                    border: "3px solid #0a0a14",
                    boxShadow: "6px 6px 0 #0a0a14",
                    borderRadius: 0,
                  }}
                >
                  <span>CLONE & RUN</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
                <p className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground mt-3">
                  Requires Docker · runs on localhost:3000
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 2 — TRY IN CLOUD */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.25 }}
            className="flex flex-col justify-between bg-card text-card-foreground relative"
            style={{
              border: "3px solid #0a0a14",
              boxShadow: "8px 8px 0 #0a0a14",
              borderRadius: 0,
            }}
          >
            {/* Top Thick Color Bar */}
            <div className="h-3 w-full bg-[#2563EB]" />

            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                {/* Header Row: Badge & Icon */}
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="h-14 w-14 flex items-center justify-center text-white"
                    style={{
                      background: "#2563EB",
                      border: "3px solid #0a0a14",
                      boxShadow: "4px 4px 0 #0a0a14",
                      borderRadius: 0,
                    }}
                  >
                    <Cloud className="h-7 w-7" />
                  </div>

                  <span
                    className="px-3 py-1 text-xs font-black uppercase tracking-widest"
                    style={{
                      background: "#F4C542",
                      color: "#0a0a14",
                      border: "2px solid #0a0a14",
                      borderRadius: 0,
                    }}
                  >
                    QUICK START
                  </span>
                </div>

                {/* Title & Subtitle */}
                <div className="mt-5">
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground">
                    TRY IN CLOUD
                  </h2>
                  <p className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground mt-1">
                    Zero setup. Start in seconds.
                  </p>
                </div>

                {/* Divider */}
                <div
                  className="my-5"
                  style={{ height: "2px", background: "#0a0a14" }}
                />

                {/* Feature Bullets */}
                <ul className="space-y-2.5 text-sm font-bold text-foreground">
                  <li className="flex items-center gap-2.5">
                    <span style={{ color: "#2563EB" }}>■</span>
                    <span>No Docker required</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span style={{ color: "#F4C542" }}>■</span>
                    <span>Bring your own API key</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span style={{ color: "#E63946" }}>■</span>
                    <span>Managed Postgres & Qdrant</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#F4C542] text-sm">⚠</span>
                    <span>File uploads limited to 10MB</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <span className="text-[#F4C542] text-sm">⚠</span>
                    <span>Cloud Qdrant (internet required)</span>
                  </li>
                </ul>

                {/* Limitation Notice Box */}
                <div
                  className="p-4 my-6 flex items-start gap-3"
                  style={{
                    background: "#F4C542",
                    border: "3px solid #0a0a14",
                    boxShadow: "4px 4px 0 #0a0a14",
                    borderRadius: 0,
                  }}
                >
                  <AlertTriangle className="h-5 w-5 text-[#0a0a14] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#0a0a14]">
                      File upload limited to 10MB in cloud mode
                    </p>
                    <p className="text-[11px] font-bold text-[#0a0a14]/80 mt-0.5">
                      For larger benchmark corpora, deploy locally via Docker.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Button & Note */}
              <div className="mt-8 pt-4">
                <a
                  href="https://railway.app/new/template"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 text-sm font-black uppercase tracking-widest text-white transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
                  style={{
                    background: "#2563EB",
                    border: "3px solid #0a0a14",
                    boxShadow: "6px 6px 0 #0a0a14",
                    borderRadius: 0,
                  }}
                >
                  <span>DEPLOY TO RAILWAY</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
                <p className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground mt-3">
                  Requires: GEMINI_API_KEY or OPENAI_API_KEY or ANTHROPIC_API_KEY
                </p>
              </div>
            </div>
          </motion.div>
        </div>

      </div>

      {/* ================= BOTTOM BAR ================= */}
      <footer
        className="relative z-10 w-full"
        style={{
          borderTop: "3px solid #0a0a14",
          background: "var(--background)",
        }}
      >
        <div className="max-w-6xl mx-auto py-5 px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-muted-foreground text-center sm:text-left">
            <span className="h-2 w-2 bg-[#E63946]" />
            <span>Built with Bauhaus precision · Open Source · MIT License</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs font-black uppercase tracking-wider text-foreground hover:text-[#2563EB] transition-colors"
            >
              Open Dashboard →
            </Link>
            <a
              href="https://github.com/paramjeetn/RagBench"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-foreground transition-transform hover:-translate-y-0.5"
              style={{
                background: "transparent",
                border: "2px solid #0a0a14",
                boxShadow: "2px 2px 0 #0a0a14",
                borderRadius: 0,
              }}
              title="GitHub Repository"
            >
              <Github className="h-4 w-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
