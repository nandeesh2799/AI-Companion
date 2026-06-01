import React, { useEffect, useRef } from 'react';
import * as PIXI from 'pixi.js-legacy';
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import eventBus from '../../engine/EventBus';

// Register Ticker
Live2DModel.registerTicker(PIXI.Ticker);

// Safely patch Live2DModel interaction registration to prevent crashes in PixiJS v7+
if (Live2DModel.prototype.registerInteraction) {
  const originalRegister = Live2DModel.prototype.registerInteraction;
  Live2DModel.prototype.registerInteraction = function(manager) {
    if (manager && typeof manager.on === 'function') {
      originalRegister.call(this, manager);
    } else {
      this._autoInteract = false;
    }
  };
}

if (Live2DModel.prototype.unregisterInteraction) {
  const originalUnregister = Live2DModel.prototype.unregisterInteraction;
  Live2DModel.prototype.unregisterInteraction = function() {
    if (this.interactionManager && typeof this.interactionManager.off === 'function') {
      originalUnregister.call(this);
    } else {
      this.interactionManager = undefined;
    }
  };
}

const CANVAS_WIDTH = 240;
const CANVAS_HEIGHT = 340;

const Live2DAvatar = ({ avatarPath, currentEmotion = 'idle', isSpeaking = false, isListening = false }) => {
  const containerRef = useRef(null);
  const appRef = useRef(null);
  const modelRef = useRef(null);

  // Maintain interactive state refs to avoid stale closures in the ticker loop
  const stateRef = useRef({
    emotion: 'idle',
    isSpeaking: false,
    isListening: false,
    amplitude: 0,
    cursor: { x: window.innerWidth / 2, y: window.innerHeight / 2 }
  });

  useEffect(() => { stateRef.current.emotion = currentEmotion; }, [currentEmotion]);
  useEffect(() => { stateRef.current.isSpeaking = isSpeaking; }, [isSpeaking]);
  useEffect(() => { stateRef.current.isListening = isListening; }, [isListening]);

  useEffect(() => {
    let isMounted = true;

    // 0. Dynamically create canvas element with explicit stylesheet sizes to prevent collapses
    const canvas = document.createElement('canvas');
    canvas.className = "pointer-events-none block";
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    
    if (containerRef.current) {
      containerRef.current.appendChild(canvas);
    }

    // 1. Initialize PixiJS Application (WebGL is required for Live2D shaders)
    const app = new PIXI.Application({
      view: canvas,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundAlpha: 0,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      forceCanvas: false
    });
    appRef.current = app;

    // 2. Resolve relative path to public folder
    const resolvedPath = avatarPath.startsWith('http') || avatarPath.startsWith('/')
      ? avatarPath
      : `/${avatarPath}`;

    let model = null;

    // Load Live2D Model (autoInteract: false prevents Pixi v7 interaction manager crashes)
    Live2DModel.from(resolvedPath, { autoInteract: false })
      .then((loadedModel) => {
        // StrictMode mount guard: if component unmounted while loading, abort and cleanup
        if (!isMounted || !appRef.current || !appRef.current.stage) {
          try { loadedModel.destroy(); } catch (e) {}
          return;
        }

        model = loadedModel;
        modelRef.current = model;

        // Add to stage
        appRef.current.stage.addChild(model);

        // Center anchor at (0.5, 0.5) so coordinates position the model from its center frame
        if (model.anchor) {
          model.anchor.set(0.5, 0.5);
        }
        model.x = CANVAS_WIDTH / 2;
        model.y = CANVAS_HEIGHT / 2 + 50; // Shift down slightly to center head when zoomed in

        // Scale model to fit the Canvas boundary (zoomed in to make her larger)
        const originalWidth = model.width || 1000;
        const originalHeight = model.height || 1000;
        const scaleX = CANVAS_WIDTH / originalWidth;
        const scaleY = CANVAS_HEIGHT / originalHeight;
        const scale = Math.min(scaleX, scaleY) * 1.45;
        model.scale.set(scale);

        console.log(`[Live2D] Model loaded & positioned. Scale: ${scale.toFixed(4)}, Size: ${model.width.toFixed(1)}x${model.height.toFixed(1)}, Position: (${model.x.toFixed(1)}, ${model.y.toFixed(1)})`);

        // Disable automatic updates so we can manually update parameters and override mouth opening post-physics
        try {
          if (model.automator) {
            model.automator.autoUpdate = false;
          } else {
            model.autoUpdate = false;
          }
        } catch (e) {
          console.warn('Could not disable autoUpdate:', e);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load Live2D model:', err);
        }
      });

    // 3. Track cursor position
    const handleMouseMove = (e) => {
      stateRef.current.cursor = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    // 4. Subscribe to voice amplitude updates from EventBus
    const unsubscribeAmp = eventBus.on('amplitude:update', (amp) => {
      stateRef.current.amplitude = amp;
    });

    // 5. Subscribe to emotion triggers to play corresponding motions
    const unsubscribeEmotion = eventBus.on('emotion:trigger', ({ emotion }) => {
      if (!model) return;

      // Map emotions to Hiyori's motion groups
      try {
        if (emotion === 'angry') {
          model.motion('FlickDown');
        } else if (emotion === 'excited') {
          model.motion('FlickUp');
        } else if (emotion === 'happy') {
          model.motion('Tap', 0); // Tap happy motion
        } else if (emotion === 'embarrassed') {
          model.motion('Flick@Body');
        } else if (emotion === 'shocked') {
          model.motion('Flick');
        } else if (emotion === 'thinking') {
          model.motion('Tap@Body');
        }
      } catch (err) {
        console.warn('Motion trigger failed:', err.message);
      }
    });

    // 6. Register manual update ticker loop
    const tickerCallback = () => {
      if (!model || !isMounted || !appRef.current || !appRef.current.stage) return;

      const elapsed = app.ticker.deltaMS;

      // Update model movements (motions, physics, eye blink)
      try {
        model.update(elapsed);
      } catch (e) {
        // Suppress logs to avoid console flooding
      }

      const setParam = (id, val) => {
        try {
          if (typeof model.setParameterValueById === 'function') {
            model.setParameterValueById(id, val);
          } else if (model.internalModel && model.internalModel.coreModel && typeof model.internalModel.coreModel.setParameterValueById === 'function') {
            model.internalModel.coreModel.setParameterValueById(id, val);
          }
        } catch (e) {}
      };

      // Override LipSync (ParamMouthOpenY) based on real-time amplitude
      const amp = stateRef.current.amplitude;
      setParam('ParamMouthOpenY', amp * 1.3);

      // Apply dynamic emotion parameter overrides for richer expressions
      const emotion = stateRef.current.emotion;
      try {
        let blush = 0;
        let eyeSmile = 0;
        let mouthForm = 0; // 0: neutral, 1: smile, -1: frown
        let browY = 0;
        let browAngle = 0;
        let eyeOpenScale = 1.0;

        if (emotion === 'happy') {
          blush = 0.5;
          eyeSmile = 1.0;
          mouthForm = 1.0;
        } else if (emotion === 'excited') {
          blush = 0.8;
          eyeSmile = 0.8;
          mouthForm = 1.0;
          browY = 0.4;
        } else if (emotion === 'angry') {
          mouthForm = -1.0;
          browAngle = -0.6;
          browY = -0.4;
        } else if (emotion === 'embarrassed') {
          blush = 0.9;
          mouthForm = -0.5;
          browY = 0.2;
        } else if (emotion === 'sleepy') {
          eyeOpenScale = 0.4;
          browY = -0.3;
        } else if (emotion === 'smug') {
          blush = 0.3;
          mouthForm = 0.8;
          eyeSmile = 0.5;
          browAngle = 0.2;
        } else if (emotion === 'shocked') {
          browY = 0.6;
          mouthForm = -0.8;
          eyeOpenScale = 1.2;
        } else if (emotion === 'thinking') {
          mouthForm = -0.2;
          browAngle = 0.3;
        }

        if (blush > 0) setParam('ParamCheek', blush);
        if (eyeSmile > 0) {
          setParam('ParamEyeLSmile', eyeSmile);
          setParam('ParamEyeRSmile', eyeSmile);
        }
        if (mouthForm !== 0) setParam('ParamMouthForm', mouthForm);
        if (browY !== 0) {
          setParam('ParamBrowLY', browY);
          setParam('ParamBrowRY', browY);
        }
        if (browAngle !== 0) {
          setParam('ParamBrowLAngle', browAngle);
          setParam('ParamBrowRAngle', browAngle);
        }
        if (eyeOpenScale !== 1.0) {
          setParam('ParamEyeLOpen', eyeOpenScale);
          setParam('ParamEyeROpen', eyeOpenScale);
        }
      } catch (e) {}

      // Track cursor focus (normalized coordinates from -1.0 to 1.0)
      const focusX = (stateRef.current.cursor.x - (window.innerWidth / 2)) / (window.innerWidth / 2);
      const focusY = (stateRef.current.cursor.y - (window.innerHeight / 2)) / (window.innerHeight / 2);
      try {
        if (typeof model.focus === 'function') {
          model.focus(focusX, focusY);
        }
      } catch (e) {
        // Suppress logs to avoid console flooding
      }
    };
    app.ticker.add(tickerCallback);

    // Cleanup
    return () => {
      isMounted = false;
      window.removeEventListener('mousemove', handleMouseMove);
      unsubscribeAmp();
      unsubscribeEmotion();
      app.ticker.remove(tickerCallback);
      
      // Destroy application and remove the dynamic canvas from DOM
      app.destroy(false, { children: true, texture: false, baseTexture: false });
      if (canvas.parentNode) {
        try {
          canvas.parentNode.removeChild(canvas);
        } catch (e) {}
      }
    };
  }, [avatarPath]);

  return (
    <div ref={containerRef} className="relative h-[340px] w-[240px]" />
  );
};

export default React.memo(Live2DAvatar);
