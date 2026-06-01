import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js-legacy';
import eventBus from '../../engine/EventBus';
import BlinkController from './BlinkController';
import BreathingMotion from './BreathingMotion';
import EyeTracker from './EyeTracker';
import MouthSync from './MouthSync';

const CANVAS_WIDTH = 220;
const CANVAS_HEIGHT = 320;
const BASE_X = CANVAS_WIDTH / 2;
const BASE_Y = 160;
const BASE_SCALE = 0.31;

const AvatarSprite = ({ currentEmotion = 'idle', isSpeaking = false, isListening = false, avatarPath }) => {
  const canvasRef = useRef(null);
  const appRef = useRef(null);
  const spriteRef = useRef(null);
  
  // Controllers
  const blinkControllerRef = useRef(null);
  const breathingRef = useRef(new BreathingMotion(3, 3000));
  const eyeTrackerRef = useRef(new EyeTracker(0.05, 4, 600));
  const mouthSyncRef = useRef(new MouthSync(80, 150));
  
  // Track state ref to avoid closure variables in Pixi ticker loop
  const stateRef = useRef({
    emotion: 'idle',
    isSpeaking: false,
    isListening: false,
    emotionIntensity: 1,
    amplitude: 0,
    blinkFrame: 'idle',
    cursor: { x: 0, y: 0 },
    // Emotion-body animation state
    shakeTime: 0,
    bounceTime: 0,
    swayTime: 0,
    shockTime: 0,
    happyTime: 0,
    embarrassedTime: 0,
    smugTime: 0,
    thinkingTime: 0
  });

  useEffect(() => {
    stateRef.current.emotion = currentEmotion;
  }, [currentEmotion]);

  useEffect(() => {
    stateRef.current.isSpeaking = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    stateRef.current.isListening = isListening;
  }, [isListening]);

  useEffect(() => {
    // 1. Initialize PixiJS Application
    const app = new PIXI.Application({
      view: canvasRef.current,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      forceCanvas: true
    });
    appRef.current = app;

    const base = avatarPath || 'assets/avatar';

    // 2. Load all sprite textures
    const textureMap = {
      idle: PIXI.Texture.from(`${base}/idle.png`),
      blink_1: PIXI.Texture.from(`${base}/blink_1.png`),
      blink_2: PIXI.Texture.from(`${base}/blink_2.png`),
      mouth_closed: PIXI.Texture.from(`${base}/mouth_closed.png`),
      mouth_a: PIXI.Texture.from(`${base}/mouth_a.png`),
      mouth_i: PIXI.Texture.from(`${base}/mouth_i.png`),
      mouth_u: PIXI.Texture.from(`${base}/mouth_u.png`),
      happy: PIXI.Texture.from(`${base}/emotion_happy.png`),
      angry: PIXI.Texture.from(`${base}/emotion_angry.png`),
      embarrassed: PIXI.Texture.from(`${base}/emotion_embarrassed.png`),
      excited: PIXI.Texture.from(`${base}/emotion_excited.png`),
      sleepy: PIXI.Texture.from(`${base}/emotion_sleepy.png`),
      smug: PIXI.Texture.from(`${base}/emotion_smug.png`),
      shocked: PIXI.Texture.from(`${base}/emotion_shocked.png`),
      thinking: PIXI.Texture.from(`${base}/emotion_thinking.png`)
    };

    // Create container and base sprite
    const container = new PIXI.Container();
    app.stage.addChild(container);

    const sprite = new PIXI.Sprite(textureMap.idle);
    sprite.anchor.set(0.5, 0.5);
    sprite.x = BASE_X;
    sprite.y = BASE_Y;
    
    // Scale avatar down to fit canvas
    sprite.scale.set(BASE_SCALE);
    container.addChild(sprite);
    spriteRef.current = sprite;

    // 2.5. Create cropped mouth textures for speech overlays (preserving base expressions)
    const mouthFrame = new PIXI.Rectangle(445, 485, 130, 75);
    const mouthTextures = {
      mouth_closed: new PIXI.Texture(textureMap.mouth_closed.baseTexture, mouthFrame),
      mouth_a: new PIXI.Texture(textureMap.mouth_a.baseTexture, mouthFrame),
      mouth_i: new PIXI.Texture(textureMap.mouth_i.baseTexture, mouthFrame),
      mouth_u: new PIXI.Texture(textureMap.mouth_u.baseTexture, mouthFrame)
    };

    // Add mouth overlay sprite as a child of the base body sprite
    const mouthSprite = new PIXI.Sprite(mouthTextures.mouth_closed);
    mouthSprite.anchor.set(0.5, 0.5);
    mouthSprite.x = -2;      // Center X offset (510 - 512)
    mouthSprite.y = 10.5;    // Center Y offset (522.5 - 512)
    mouthSprite.visible = false;
    sprite.addChild(mouthSprite);

    // 3. Initialize Blink controller
    blinkControllerRef.current = new BlinkController((blinkFrame) => {
      stateRef.current.blinkFrame = blinkFrame;
    });
    blinkControllerRef.current.start();

    // 4. Cursor tracking handler
    const handleMouseMove = (e) => {
      stateRef.current.cursor = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 5. Subscribe to EventBus voice amplitudes
    const unsubscribeAmp = eventBus.on('amplitude:update', (amp) => {
      stateRef.current.amplitude = amp;
    });

    // 5.5. Subscribe to emotion triggers for body animation
    const unsubscribeEmotion = eventBus.on('emotion:trigger', ({ emotion, intensity = 1 }) => {
      const safeIntensity = Math.min(1.6, Math.max(0.55, Number(intensity) || 1));
      stateRef.current.emotionIntensity = safeIntensity;
      const nowMs = Date.now();

      if (emotion === 'angry') {
        stateRef.current.shakeTime = nowMs;
      } else if (emotion === 'excited') {
        stateRef.current.bounceTime = nowMs;
      } else if (emotion === 'sleepy') {
        stateRef.current.swayTime = nowMs;
      } else if (emotion === 'shocked') {
        stateRef.current.shockTime = nowMs;
      } else if (emotion === 'happy') {
        stateRef.current.happyTime = nowMs;
      } else if (emotion === 'embarrassed') {
        stateRef.current.embarrassedTime = nowMs;
      } else if (emotion === 'smug') {
        stateRef.current.smugTime = nowMs;
      } else if (emotion === 'thinking') {
        stateRef.current.thinkingTime = nowMs;
      }
    });

    // 6. Pixi Application Ticker loop (60fps max)
    let lastTime = Date.now();
    app.ticker.add(() => {
      const now = Date.now();
      const dt = now - lastTime;
      lastTime = now;

      // Update texture based on speaking and emotion state
      let activeTexture = textureMap.idle;
      const emo = stateRef.current.emotion;

      // The base sprite should display either blinking frame or current emotion
      if (stateRef.current.blinkFrame !== 'idle') {
        activeTexture = textureMap[stateRef.current.blinkFrame] || textureMap.idle;
      } else {
        activeTexture = textureMap[emo] || textureMap.idle;
      }

      if (sprite.texture !== activeTexture) {
        sprite.texture = activeTexture;
      }

      // overlay mouth animation while speaking to preserve current emotion eyes/brows
      if (stateRef.current.isSpeaking) {
        const mouthState = mouthSyncRef.current.getMouthState(stateRef.current.amplitude);
        mouthSprite.texture = mouthTextures[mouthState] || mouthTextures.mouth_closed;
        mouthSprite.visible = true;
      } else {
        mouthSprite.visible = false;
      }

      // Apply Breathing motion (float offset & subtle scale pulse)
      const { yOffset, scaleFactor } = breathingRef.current.getTransform();
      
      // Update eye/head tracking coordinates
      const eyeTracker = eyeTrackerRef.current;
      eyeTracker.updateCursor(
        stateRef.current.cursor.x,
        stateRef.current.cursor.y,
        BASE_X,
        BASE_Y
      );
      const pupilOffset = eyeTracker.tick();

      // Apply cumulative translations
      // Head/body shifts up to ±4px in direction of cursor (parallax effect)
      let emotionOffsetX = 0;
      let emotionOffsetY = 0;
      let emotionScaleBonus = 0;
      const nowMs = Date.now();
      const reactionPower = stateRef.current.emotionIntensity;

      // Angry: rapid horizontal shake for 800ms
      const shakeAge = nowMs - stateRef.current.shakeTime;
      if (stateRef.current.shakeTime > 0 && shakeAge < 800) {
        const shakeT = shakeAge / 800;
        const decay = 1 - shakeT;
        emotionOffsetX = Math.sin(shakeAge * 0.07) * 7 * decay * reactionPower;
      }

      // Excited: upward bounce for 1200ms
      const bounceAge = nowMs - stateRef.current.bounceTime;
      if (stateRef.current.bounceTime > 0 && bounceAge < 1200) {
        const t = bounceAge / 1200;
        emotionOffsetY = -Math.abs(Math.sin(t * Math.PI * 3)) * 12 * (1 - t) * reactionPower;
        emotionScaleBonus = Math.abs(Math.sin(t * Math.PI * 2)) * 0.04 * (1 - t) * reactionPower;
      }

      // Sleepy: gentle slow sway for 3000ms
      const swayAge = nowMs - stateRef.current.swayTime;
      if (stateRef.current.swayTime > 0 && swayAge < 3000) {
        const t = swayAge / 3000;
        emotionOffsetX += Math.sin(swayAge * 0.002) * 4 * (1 - t * 0.5) * (0.8 + reactionPower * 0.2);
        emotionOffsetY += Math.sin(swayAge * 0.001) * 2;
      }

      // Shocked: quick recoil + jitter for 700ms
      const shockAge = nowMs - stateRef.current.shockTime;
      if (stateRef.current.shockTime > 0 && shockAge < 700) {
        const t = shockAge / 700;
        const decay = 1 - t;
        emotionOffsetY -= 16 * Math.sin(t * Math.PI) * reactionPower;
        emotionOffsetX += Math.sin(shockAge * 0.12) * 2.4 * decay * reactionPower;
        emotionScaleBonus += 0.025 * Math.sin(t * Math.PI) * reactionPower;
      }

      // Happy: buoyant idle bob for 1000ms after trigger and while happy remains active
      const happyAge = nowMs - stateRef.current.happyTime;
      if ((stateRef.current.emotion === 'happy' && !stateRef.current.isSpeaking) || (stateRef.current.happyTime > 0 && happyAge < 1000)) {
        emotionOffsetY -= Math.abs(Math.sin(nowMs * 0.012)) * 2.2 * (0.8 + reactionPower * 0.2);
        emotionScaleBonus += Math.sin(nowMs * 0.007) * 0.008;
      }

      // Embarrassed: tiny jitter and subtle shrink posture
      const embarrassedAge = nowMs - stateRef.current.embarrassedTime;
      if ((stateRef.current.emotion === 'embarrassed' && !stateRef.current.isSpeaking) || (stateRef.current.embarrassedTime > 0 && embarrassedAge < 1200)) {
        emotionOffsetX += Math.sin(nowMs * 0.04) * 0.9 * reactionPower;
        emotionOffsetY += 1.2;
        emotionScaleBonus -= 0.012;
      }

      // Smug: slight lean and confident pulse
      const smugAge = nowMs - stateRef.current.smugTime;
      if (stateRef.current.emotion === 'smug' || (stateRef.current.smugTime > 0 && smugAge < 1200)) {
        emotionOffsetX += 2.2 * (0.8 + reactionPower * 0.2);
        emotionScaleBonus += Math.sin(nowMs * 0.006) * 0.01;
      }

      // Thinking: soft side sway while processing
      const thinkingAge = nowMs - stateRef.current.thinkingTime;
      if (stateRef.current.emotion === 'thinking' || (stateRef.current.thinkingTime > 0 && thinkingAge < 1200)) {
        emotionOffsetX += Math.sin(nowMs * 0.004) * 1.4;
        emotionOffsetY += Math.sin(nowMs * 0.008) * 1.1;
      }

      // Listening: subtle movement keeps avatar alive while mic is open
      if (stateRef.current.isListening && !stateRef.current.isSpeaking) {
        emotionOffsetX += Math.sin(nowMs * 0.018) * 1.1;
        emotionOffsetY += Math.sin(nowMs * 0.011) * 0.8;
      }

      sprite.x = BASE_X + pupilOffset.x + emotionOffsetX;
      sprite.y = BASE_Y + yOffset + pupilOffset.y + emotionOffsetY;
      sprite.scale.set((BASE_SCALE + emotionScaleBonus) * scaleFactor);
    });

    // Clean up
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      unsubscribeAmp();
      unsubscribeEmotion();
      if (blinkControllerRef.current) {
        blinkControllerRef.current.stop();
      }
      app.destroy(false, { children: true, texture: false, baseTexture: false });
    };
  }, [avatarPath]);

  return (
    <div className="relative h-[340px] w-[240px]">
      <canvas ref={canvasRef} className="pointer-events-none block" />
    </div>
  );
};

export default React.memo(AvatarSprite);
