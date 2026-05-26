import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import eventBus from '../../engine/EventBus';

// Stable seeded random helpers (pre-computed so no jitter on re-renders)
const SEEDS = Array.from({ length: 20 }, (_, i) => ({
  x: 20 + ((i * 73 + 31) % 240),
  y: 30 + ((i * 137 + 17) % 320),
  delay: (i * 0.13) % 2,
  dur: 1.2 + (i % 5) * 0.3,
  size: 12 + (i % 4) * 6,
  rotate: (i * 47) % 360,
}));

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getOverlayDuration = (emotion, intensity = 1) => {
  const base = emotion === 'excited' ? 4000 : emotion === 'embarrassed' ? 5000 : 3500;
  return Math.round(base * (0.85 + intensity * 0.35));
};

const EmotionOverlay = () => {
  const [activeOverlay, setActiveOverlay] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = eventBus.on('emotion:trigger', ({ emotion, intensity }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      const id = Date.now();
      const safeIntensity = clamp(Number(intensity) || 1, 0.55, 1.6);
      setActiveOverlay({ id, emotion, intensity: safeIntensity });

      // Keep overlays alive long enough for the speaking animation to finish
      const duration = getOverlayDuration(emotion, safeIntensity);
      timerRef.current = setTimeout(() => {
        setActiveOverlay(prev => (prev && prev.id === id ? null : prev));
      }, duration);
    });

    // Also dismiss on speech:end to keep things clean
    const unsubEnd = eventBus.on('speech:end', () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setActiveOverlay(null), 800);
    });

    return () => {
      unsubscribe();
      unsubEnd();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const { emotion, intensity = 1 } = activeOverlay || {};
  const overlayScale = 0.94 + intensity * 0.08;
  const burstScale = 0.88 + intensity * 0.24;
  const excitedParticleCount = Math.min(18, 8 + Math.round(intensity * 6));

  return (
    <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
      <AnimatePresence mode="sync">

        {/* ─── ANGRY: red screen flash + vein pop bursts ─── */}
        {emotion === 'angry' && (
          <motion.div key="angry" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: overlayScale }} exit={{ opacity: 0 }}>
            {/* Red vignette flash */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              animate={{ boxShadow: ['inset 0 0 0px rgba(239,68,68,0)', `inset 0 0 ${Math.round(45 + intensity * 24)}px rgba(239,68,68,0.55)`, 'inset 0 0 20px rgba(239,68,68,0.2)'] }}
              transition={{ duration: 0.6, times: [0, 0.3, 1] }}
            />
            {/* Main vein pop */}
            <motion.div
              className="absolute text-red-500 select-none"
              style={{ right: 28, top: 118, fontSize: Math.round(34 + intensity * 8) }}
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: [0, 1.4 * burstScale, 1.05 * burstScale], rotate: [-20, 5, 0] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            >💢</motion.div>
            {/* Secondary smaller vein */}
            <motion.div
              className="absolute text-red-400 select-none"
              style={{ right: 56, top: 148, fontSize: 22 }}
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 0.9] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.15 }}
            >💢</motion.div>
            {/* Exclamation */}
            <motion.div
              className="absolute font-black select-none"
              style={{ right: 18, top: 90, fontSize: 28, color: '#ff4444', textShadow: '0 0 12px rgba(255,68,68,0.8)' }}
              initial={{ scale: 0, y: 10 }}
              animate={{ scale: [0, 1.5, 1], y: [10, -5, 0] }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 12, delay: 0.2 }}
            >!!</motion.div>
          </motion.div>
        )}

        {/* ─── HAPPY: floating hearts of varying sizes ─── */}
        {emotion === 'happy' && (
          <motion.div key="happy" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: overlayScale }} exit={{ opacity: 0 }}>
            {[
              { x: 30,  size: 28, delay: 0,    color: '#ff6eb4' },
              { x: 220, size: 20, delay: 0.25, color: '#ff8fd4' },
              { x: 70,  size: 16, delay: 0.5,  color: '#ffb3e0' },
              { x: 190, size: 24, delay: 0.1,  color: '#ff6eb4' },
              { x: 130, size: 18, delay: 0.65, color: '#ff8fd4' },
              { x: 50,  size: 14, delay: 0.8,  color: '#ffccee' },
            ].map((h, i) => (
              <motion.div
                key={i}
                className="absolute select-none"
                style={{ left: h.x, bottom: 80, fontSize: Math.round(h.size * (0.88 + intensity * 0.12)), color: h.color, filter: 'drop-shadow(0 0 4px rgba(255,110,180,0.6))' }}
                initial={{ opacity: 0, y: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 1, 0], y: [0, -60, -120 - intensity * 20, -165 - intensity * 20], scale: [0, 1.2, 1, 0.6] }}
                transition={{ duration: 2.2, delay: h.delay, repeat: Infinity, ease: 'easeOut' }}
              >♥</motion.div>
            ))}
            {/* Warm glow aura */}
            <motion.div
              className="absolute rounded-full"
              style={{ left: 80, top: 60, width: 120, height: 120, background: 'radial-gradient(circle, rgba(255,110,180,0.15) 0%, transparent 70%)' }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}

        {/* ─── EMBARRASSED: deep blush cheeks + sparkle hearts ─── */}
        {emotion === 'embarrassed' && (
          <motion.div key="embarrassed" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: overlayScale }} exit={{ opacity: 0, transition: { duration: 0.8 } }}>
            {/* Left blush */}
            <motion.div
              className="absolute rounded-full"
              style={{ left: 22, top: 195, width: 58, height: 28, background: 'rgba(255, 100, 140, 0.5)', filter: 'blur(10px)' }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.8, 0.7], scale: [0.5, 1.1, 1] }}
              transition={{ duration: 0.5 }}
            />
            {/* Right blush */}
            <motion.div
              className="absolute rounded-full"
              style={{ right: 22, top: 195, width: 58, height: 28, background: 'rgba(255, 100, 140, 0.5)', filter: 'blur(10px)' }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 0.8, 0.7], scale: [0.5, 1.1, 1] }}
              transition={{ duration: 0.5, delay: 0.05 }}
            />
            {/* Sparkle burst above head */}
            {[0, 1, 2, 3, 4].map(i => (
              <motion.div
                key={i}
                className="absolute select-none"
                style={{
                  left: 90 + Math.cos((i / 5) * Math.PI * 2) * 50,
                  top: 55 + Math.sin((i / 5) * Math.PI * 2) * 30,
                  fontSize: 14 + (i % 3) * 4,
                  color: '#ff90cc',
                  filter: 'drop-shadow(0 0 6px rgba(255,110,180,0.9))',
                }}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: [0, 1, 0], scale: [0, 1.4, 0] }}
                transition={{ duration: 1.5, delay: i * 0.18, repeat: Infinity, repeatDelay: 1.2 }}
              >✦</motion.div>
            ))}
            {/* Sweat drop */}
            <motion.div
              className="absolute select-none text-blue-300"
              style={{ right: 40, top: 75, fontSize: 20 }}
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: [0, 1, 0.8], y: [-5, 5, 8] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.8 }}
            >💧</motion.div>
          </motion.div>
        )}

        {/* ─── EXCITED: full confetti burst + energy rings ─── */}
        {emotion === 'excited' && (
          <motion.div key="excited" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: overlayScale }} exit={{ opacity: 0 }}>
            {/* Energy ring pulse */}
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-full border-2 border-yellow-400/60"
                style={{ left: 70, top: 70, width: 140, height: 140 }}
                initial={{ scale: 0.5, opacity: 0.8 }}
                animate={{ scale: [0.5, 2.5], opacity: [0.8, 0] }}
                transition={{ duration: 1.5, delay: i * 0.4, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}
            {/* Confetti particles */}
            {SEEDS.slice(0, excitedParticleCount).map((s, i) => (
              <motion.div
                key={i}
                className="absolute rounded-sm select-none"
                style={{
                  left: s.x,
                  width: 6 + (i % 3) * 3,
                  height: 6 + (i % 3) * 3,
                  background: ['#ff6eb4','#ffe066','#66e0ff','#b0ff66','#ff9966','#cc99ff'][i % 6],
                  borderRadius: i % 2 === 0 ? '50%' : '2px',
                }}
                initial={{ y: 380, opacity: 1, rotate: s.rotate }}
                animate={{ y: [380, s.y - intensity * 24], opacity: [1, 1, 0], rotate: [s.rotate, s.rotate + 360] }}
                transition={{ duration: Math.max(0.9, s.dur - intensity * 0.2), delay: s.delay, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}
            {/* Star burst */}
            <motion.div
              className="absolute select-none"
              style={{ left: 120, top: 30, fontSize: 32, color: '#ffe066', filter: 'drop-shadow(0 0 10px rgba(255,224,102,0.9))' }}
              animate={{ scale: [1, 1.4, 1], rotate: [0, 20, -20, 0] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >⭐</motion.div>
          </motion.div>
        )}

        {/* ─── SLEEPY: cascading ZZZ bubbles ─── */}
        {emotion === 'sleepy' && (
          <motion.div key="sleepy" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: overlayScale }} exit={{ opacity: 0 }}>
            {[
              { x: 190, startY: 120, size: 18, delay: 0 },
              { x: 210, startY: 90,  size: 24, delay: 0.8 },
              { x: 230, startY: 60,  size: 30, delay: 1.6 },
            ].map((z, i) => (
              <motion.div
                key={i}
                className="absolute font-black select-none"
                style={{ left: z.x, top: z.startY, fontSize: z.size, color: '#a0b4ff', textShadow: '0 0 8px rgba(160,180,255,0.8)' }}
                initial={{ opacity: 0, y: 0, x: 0 }}
                animate={{ opacity: [0, 1, 1, 0], y: [0, -30, -55, -80], x: [0, 8, 4, 12] }}
                transition={{ duration: 2.4, delay: z.delay, repeat: Infinity, ease: 'easeInOut' }}
              >Z</motion.div>
            ))}
            {/* Dim blue vignette */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              animate={{ boxShadow: ['inset 0 0 0px rgba(100,130,255,0)', 'inset 0 0 50px rgba(100,130,255,0.2)', 'inset 0 0 30px rgba(100,130,255,0.1)'] }}
              transition={{ duration: 2, repeat: Infinity, repeatType: 'reverse' }}
            />
          </motion.div>
        )}

        {/* ─── SMUG: sunglasses drop + sparkle ─── */}
        {emotion === 'smug' && (
          <motion.div key="smug" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: overlayScale }} exit={{ opacity: 0 }}>
            {/* Sunglasses drop-in */}
            <motion.div
              className="absolute select-none"
              style={{ left: 80, top: 130, fontSize: 50 }}
              initial={{ y: -60, opacity: 0, rotate: -15 }}
              animate={{ y: 0, opacity: 1, rotate: [-15, 5, 0] }}
              exit={{ y: -40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
            >😎</motion.div>
            {/* Sparkle accents */}
            {[{ x: 42, y: 118 }, { x: 218, y: 125 }, { x: 140, y: 95 }].map((p, i) => (
              <motion.div
                key={i}
                className="absolute select-none text-yellow-300"
                style={{ left: p.x, top: p.y, fontSize: 14, filter: 'drop-shadow(0 0 4px rgba(255,220,0,0.8))' }}
                animate={{ scale: [0, 1.3, 0], rotate: [0, 180, 360] }}
                transition={{ duration: 1.2, delay: i * 0.3, repeat: Infinity, repeatDelay: 1.5 }}
              >✦</motion.div>
            ))}
          </motion.div>
        )}

        {/* ─── SHOCKED: exclamation burst + electric flash ─── */}
        {emotion === 'shocked' && (
          <motion.div key="shocked" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: overlayScale }} exit={{ opacity: 0 }}>
            {/* White flash */}
            <motion.div
              className="absolute inset-0 rounded-2xl bg-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.2 + intensity * 0.14, 0] }}
              transition={{ duration: 0.25, times: [0, 0.1, 1] }}
            />
            {/* Main exclamation */}
            <motion.div
              className="absolute font-black select-none"
              style={{ left: 105, top: 40, fontSize: 48, color: '#ffe066', textShadow: '0 0 20px rgba(255,200,0,1), 0 0 40px rgba(255,150,0,0.6)' }}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: [0, 1.6, 1.2], rotate: [-10, 5, 0] }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 700, damping: 12 }}
            >!</motion.div>
            {/* Shock lines */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => (
              <motion.div
                key={i}
                className="absolute bg-yellow-400 rounded-full"
                style={{
                  left: 127 + Math.cos((angle * Math.PI) / 180) * 30,
                  top: 68 + Math.sin((angle * Math.PI) / 180) * 30,
                  width: 2,
                  height: 18,
                  rotate: angle,
                  transformOrigin: 'center top',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: [0, 1, 0], opacity: [0, 1, 0] }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.03 }}
              />
            ))}
          </motion.div>
        )}

        {/* ─── THINKING: animated thought bubble with dots ─── */}
        {emotion === 'thinking' && (
          <motion.div key="thinking" className="absolute inset-0" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: overlayScale }} exit={{ opacity: 0 }}>
            {/* Thought bubble trail dots */}
            {[
              { x: 205, y: 170, size: 6 },
              { x: 218, y: 152, size: 9 },
              { x: 234, y: 130, size: 13 },
            ].map((dot, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full bg-blue-200/80"
                style={{ left: dot.x, top: dot.y, width: dot.size, height: dot.size }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.9 }}
                transition={{ delay: i * 0.12, type: 'spring', stiffness: 400 }}
              />
            ))}
            {/* Main thought cloud */}
            <motion.div
              className="absolute rounded-2xl px-3 py-2 select-none"
              style={{ right: 8, top: 68, background: 'rgba(200, 220, 255, 0.92)', boxShadow: '0 4px 20px rgba(100,150,255,0.3)', border: '1.5px solid rgba(160,190,255,0.5)', minWidth: 56 }}
              initial={{ scale: 0, opacity: 0, x: 20 }}
              animate={{ scale: 1, opacity: 1, x: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 18, delay: 0.3 }}
            >
              {/* Animated ellipsis */}
              <div className="flex gap-1 items-center justify-center">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full bg-blue-500"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.7, delay: i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
              </div>
            </motion.div>
            {/* Lightbulb hint */}
            <motion.div
              className="absolute select-none"
              style={{ right: 14, top: 42, fontSize: 18, filter: 'drop-shadow(0 0 8px rgba(255,220,50,0.9))' }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >💡</motion.div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default EmotionOverlay;
