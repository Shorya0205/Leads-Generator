"use client";

import Link from "next/link";
import { SignInButton } from "@/components/sign-in-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Sparkles, Shield, Zap, Send, Users, Calendar, ArrowRight, CheckCircle2, ChevronRight, Mail } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function HomePage() {
  const targetRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end start"]
  });

  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);
  const y = useTransform(scrollYProgress, [0, 0.5], [0, 50]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] dark:bg-[#090A0F] text-slate-900 dark:text-slate-100 font-sans antialiased overflow-hidden selection:bg-blue-500/30">
      
      {/* ── Dynamic Backgrounds ── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 dark:bg-blue-600/10 blur-[120px] mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/10 dark:bg-indigo-600/10 blur-[120px] mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[50%] rounded-full bg-emerald-500/5 dark:bg-emerald-600/5 blur-[120px] mix-blend-screen" />
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23000000\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }}
        />
      </div>

      {/* ── Navbar ── */}
      <motion.header 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-[#090A0F]/70 backdrop-blur-xl border-b border-white/20 dark:border-white/5 shadow-sm"
      >
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-all duration-300">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
              ReachOut
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <SignInButton variant="nav" />
          </div>
        </div>
      </motion.header>

      {/* ── Hero ── */}
      <motion.section 
        ref={targetRef}
        style={{ opacity, scale, y }}
        className="relative pt-40 pb-20 px-6 z-10 flex flex-col items-center justify-center min-h-[90vh]"
      >
        <div className="relative mx-auto max-w-5xl text-center">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="inline-flex items-center gap-2 mb-8 px-4 py-2 rounded-full border border-blue-200/50 dark:border-blue-500/20 bg-blue-50/50 dark:bg-blue-500/10 backdrop-blur-md shadow-sm"
          >
            <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">AI-Powered Outreach Platform 2.0</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-5xl sm:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[1.05] text-slate-900 dark:text-white mb-8"
          >
            Land your dream role with <br className="hidden lg:block" />
            <span className="relative inline-block mt-2">
              <span className="absolute -inset-1 blur-2xl opacity-20 bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 rounded-lg"></span>
              <span className="relative bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600">
                hyper-personalized AI
              </span>
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-2xl text-lg sm:text-xl text-slate-600 dark:text-slate-300 leading-relaxed mb-12"
          >
            Stop sending generic templates. Automatically generate and send bespoke cold emails tailored to each company, straight from your Gmail.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full blur opacity-40 group-hover:opacity-70 transition duration-500"></div>
              <div className="relative">
                <SignInButton variant="primary" />
              </div>
            </div>
            
            <Link 
              href="#features" 
              className="flex items-center gap-2 px-6 py-3.5 rounded-full border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold backdrop-blur-sm transition-all duration-300"
            >
              See how it works
              <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* ── Stats / Tech Stack ── */}
      <section className="relative z-10 py-12 border-y border-white/20 dark:border-white/5 bg-white/40 dark:bg-[#0A0C14]/40 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-center text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-8">Powered by Industry-Leading Tech</p>
          <motion.div 
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12 text-center"
          >
            {[
              { value: "Llama 3.3", label: "70B Parameter AI Engine", icon: Zap },
              { value: "AES-256", label: "Military-grade Encryption", icon: Shield },
              { value: "Smart Throttle", label: "Anti-spam Protection", icon: Sparkles },
              { value: "450+", label: "Daily Email Capacity", icon: Send },
            ].map((stat, i) => (
              <motion.div key={i} variants={fadeIn} className="flex flex-col items-center group">
                <div className="mb-3 p-3 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform duration-300">
                  <stat.icon className="h-6 w-6 text-blue-500" />
                </div>
                <div className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{stat.value}</div>
                <div className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="relative z-10 py-32 px-6">
        <div className="mx-auto max-w-7xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
              Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500">get hired</span>
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
              Built specifically for students and professionals who want to automate their outreach without sounding like a robot.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Sparkles,
                color: "from-blue-500 to-cyan-400",
                bg: "bg-blue-50 dark:bg-blue-900/20",
                border: "border-blue-100 dark:border-blue-800/50",
                title: "Hyper-Personalization",
                desc: "Auto-detects target company from the recipient's email domain and generates a bespoke, authentic email instantly.",
              },
              {
                icon: Shield,
                color: "from-emerald-500 to-teal-400",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
                border: "border-emerald-100 dark:border-emerald-800/50",
                title: "Maximum Security",
                desc: "Your Gmail App Password is encrypted at rest using AES-256-GCM. Your credentials are never exposed in plain text.",
              },
              {
                icon: Zap,
                color: "from-violet-500 to-purple-400",
                bg: "bg-violet-50 dark:bg-violet-900/20",
                border: "border-violet-100 dark:border-violet-800/50",
                title: "Smart Throttling",
                desc: "Intelligent pacing with Fast, Safe, and Stealth modes keeps your Gmail reputation pristine and avoids spam filters.",
              },
              {
                icon: Users,
                color: "from-orange-500 to-amber-400",
                bg: "bg-orange-50 dark:bg-orange-900/20",
                border: "border-orange-100 dark:border-orange-800/50",
                title: "Bulk CSV Import",
                desc: "Upload hundreds of leads in seconds. Companies are auto-detected, making list management effortless.",
              },
              {
                icon: Calendar,
                color: "from-pink-500 to-rose-400",
                bg: "bg-pink-50 dark:bg-pink-900/20",
                border: "border-pink-100 dark:border-pink-800/50",
                title: "Visual Analytics",
                desc: "Track your daily send volume through an interactive heatmap calendar. Monitor exactly who received what.",
              },
              {
                icon: Send,
                color: "from-indigo-500 to-blue-500",
                bg: "bg-indigo-50 dark:bg-indigo-900/20",
                border: "border-indigo-100 dark:border-indigo-800/50",
                title: "Auto-Attachments",
                desc: "Upload your resume PDF once and it automatically attaches to every outgoing email in your campaign.",
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -5 }}
                className={`relative group overflow-hidden rounded-3xl border ${f.border} bg-white/50 dark:bg-[#11131E]/50 backdrop-blur-xl p-8 shadow-sm hover:shadow-xl transition-all duration-300`}
              >
                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${f.color} opacity-[0.08] dark:opacity-[0.05] rounded-bl-full transition-transform duration-500 group-hover:scale-110`} />
                
                <div className={`mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${f.bg} shadow-inner`}>
                  <f.icon className="h-7 w-7 text-slate-800 dark:text-white" />
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">{f.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative z-10 py-32 px-6 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-50/50 dark:via-blue-900/10 to-transparent pointer-events-none" />
        
        <div className="relative mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
                Three steps to your next opportunity
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-10">
                We've abstracted away all the complexity of cold emailing. You focus on the leads, we'll handle the personalization and delivery.
              </p>

              <div className="space-y-8">
                {[
                  { step: "01", title: "Connect your Gmail", desc: "Securely link your account using an App Password. We test the connection instantly." },
                  { step: "02", title: "Drop your leads", desc: "Upload a CSV or add emails manually. Our AI figures out the company context." },
                  { step: "03", title: "Launch & Relax", desc: "Hit send. We'll generate tailored emails and pace the delivery to protect your inbox." },
                ].map((s, i) => (
                  <div key={i} className="flex gap-6 group">
                    <div className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-xl border border-blue-200 dark:border-blue-800/50 group-hover:scale-110 group-hover:bg-blue-500 group-hover:text-white transition-all duration-300">
                      {s.step}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{s.title}</h3>
                      <p className="text-slate-600 dark:text-slate-400">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Abstract UI Mockup */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, rotateY: 10 }}
              whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative perspective-1000"
            >
              <div className="relative rounded-2xl border border-white/40 dark:border-white/10 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl shadow-2xl overflow-hidden transform -rotate-2 hover:rotate-0 transition-transform duration-500">
                <div className="h-12 border-b border-slate-200 dark:border-slate-800 flex items-center px-4 gap-2 bg-slate-50 dark:bg-slate-950">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  </div>
                </div>
                <div className="p-8">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/50 animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded w-1/4" />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-11/12" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-4/5" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  </div>
                  <div className="mt-8 flex gap-3">
                    <div className="h-10 bg-blue-500 rounded-lg w-32 shadow-lg shadow-blue-500/20" />
                    <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-24" />
                  </div>
                </div>
              </div>
              
              {/* Floating element */}
              <motion.div 
                animate={{ y: [0, -15, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-8 -top-8 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 flex items-center gap-3"
              >
                <div className="bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-full">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">Sent successfully</div>
                  <div className="text-xs text-slate-500">to recruiter@stripe.com</div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative z-10 py-32 px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-5xl rounded-3xl overflow-hidden relative"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700"></div>
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
          
          <div className="relative p-12 md:p-20 text-center text-white">
            <h2 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight">
              Ready to automate your outreach?
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto leading-relaxed">
              Join thousands of students and professionals who are landing interviews on autopilot. No credit card required.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <SignInButton variant="primary" />
            </div>
            
            <p className="mt-6 text-sm text-blue-200/60 flex items-center justify-center gap-1">
              <Shield className="h-4 w-4" /> Secure login via Clerk
            </p>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-md py-12 px-6">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center shadow-inner">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">ReachOut</span>
          </div>
          
          <div className="text-slate-500 dark:text-slate-400 text-sm">
            © {new Date().getFullYear()} ReachOut. Open-source MIT License.
          </div>
          
          <div className="flex items-center gap-4 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#" className="hover:text-blue-500 transition-colors">Privacy</a>
            <a href="#" className="hover:text-blue-500 transition-colors">Terms</a>
            <a href="https://github.com/Shorya0205/Leads-Generator" target="_blank" className="hover:text-blue-500 transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
