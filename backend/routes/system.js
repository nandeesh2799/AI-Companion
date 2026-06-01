const express = require('express');
const router = express.Router();
const os = require('os');
const { exec } = require('child_process');
const db = require('../db/database.js');

const fs = require('fs');
const path = require('path');

// Helper to query active window title on Linux
function getActiveWindowTitle() {
  return new Promise((resolve) => {
    // xdotool getactivewindow getwindowname fetches current focused window name
    exec('xdotool getactivewindow getwindowname', (error, stdout, stderr) => {
      if (error) {
        // Fallback to xprop if xdotool fails
        exec("xprop -id $(xprop -root _NET_ACTIVE_WINDOW | cut -d' ' -f5) _NET_WM_NAME | cut -d'\"' -f2", (err2, stdout2) => {
          if (err2) {
            return resolve("Desktop");
          }
          resolve(stdout2.trim());
        });
        return;
      }
      resolve(stdout.trim());
    });
  });
}

// Helper for music playback status
function getMusicPlayback() {
  return new Promise((resolve) => {
    exec('playerctl status && playerctl metadata --format "{{ artist }} - {{ title }}"', (error, stdout) => {
      if (error) {
        return resolve(null);
      }
      const lines = stdout.trim().split('\n');
      const status = lines[0] || 'Stopped';
      const metadata = lines[1] || '';
      resolve({ status, track: metadata });
    });
  });
}

// Helper for user idle state
function getUserIdleTime() {
  return new Promise((resolve) => {
    exec('xprintidle', (error, stdout) => {
      if (error) {
        return resolve(0);
      }
      const idleMs = parseInt(stdout.trim(), 10);
      resolve(isNaN(idleMs) ? 0 : idleMs);
    });
  });
}

// Helper for active processes (browsers, IDEs, common apps)
function getSystemApps() {
  return new Promise((resolve) => {
    exec('ps -eo comm', (error, stdout) => {
      if (error) {
        return resolve({ apps: [], coding: [], browsers: [] });
      }
      const processes = stdout.split('\n').map(p => p.trim().toLowerCase());
      const uniqueProcesses = [...new Set(processes)];

      const browsersList = ['chrome', 'firefox', 'opera', 'brave', 'microsoft-edge', 'edge', 'chromium'];
      const codingList = ['code', 'cursor', 'sublime_text', 'sublime', 'pycharm', 'webstorm', 'clion', 'idea', 'eclipse', 'netbeans', 'vim', 'nvim', 'emacs', 'atom'];
      const commonAppsList = ['spotify', 'vlc', 'discord', 'slack', 'thunderbird', 'gimp', 'inkscape', 'blender', 'steam', 'zoom', 'teams'];

      const browsers = uniqueProcesses.filter(p => browsersList.some(b => p.includes(b)));
      const coding = uniqueProcesses.filter(p => codingList.some(c => p.includes(c)));
      const activeApps = uniqueProcesses.filter(p => commonAppsList.some(a => p.includes(a)));

      resolve({
        browsers: browsers.map(b => b.replace('-bin', '')),
        coding: coding,
        activeApps: activeApps
      });
    });
  });
}

// Helper to get recently used files (file operations)
function getRecentFiles() {
  return new Promise((resolve) => {
    const filePath = path.join(os.homedir(), '.local', 'share', 'recently-used.xbel');
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) return resolve([]);
      // Find all file urls
      const matches = [...data.matchAll(/href="file:\/\/([^"]+)"/g)];
      // Get paths and reverse to show most recent first
      const files = matches.map(m => {
        try {
          return decodeURIComponent(m[1]);
        } catch (e) {
          return m[1];
        }
      }).reverse();
      const uniqueFiles = [...new Set(files)].slice(0, 5);
      resolve(uniqueFiles);
    });
  });
}

// GET active window, CPU and Memory stats
router.get('/status', async (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    
    // Calculate approximate CPU utilization
    const cpus = os.cpus();
    const load = os.loadavg();
    const cpuPercent = Math.round((load[0] / cpus.length) * 100);

    const activeWindow = await getActiveWindowTitle();
    const music = await getMusicPlayback();
    const idleMs = await getUserIdleTime();
    const apps = await getSystemApps();
    const recentFiles = await getRecentFiles();

    res.json({
      cpu: Math.min(cpuPercent, 100),
      ram: memPercent,
      activeWindow: activeWindow || "Desktop",
      music: music,
      idleTime: idleMs,
      apps: apps,
      recentFiles: recentFiles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all characters (Profiles switcher)
router.get('/characters', (req, res) => {
  try {
    const characters = db.prepare('SELECT * FROM characters ORDER BY is_default DESC, name ASC').all();
    res.json(characters);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set the default character profile
router.patch('/characters/:id/default', (req, res) => {
  const { id } = req.params;
  try {
    const character = db.prepare('SELECT id FROM characters WHERE id = ?').get(id);
    if (!character) {
      return res.status(404).json({ error: 'Character not found.' });
    }

    const transaction = db.transaction(() => {
      db.prepare('UPDATE characters SET is_default = 0').run();
      db.prepare('UPDATE characters SET is_default = 1 WHERE id = ?').run(id);
    });
    transaction();

    const updatedCharacter = db.prepare('SELECT * FROM characters WHERE id = ?').get(id);
    res.json(updatedCharacter);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST to create a new Character (Unlimited Characters)
router.post('/characters', (req, res) => {
  const { name, systemPrompt, avatarType = '2d', avatarPath = '', aiProvider = 'gemini', ttsProvider = 'edge-tts', voiceId = 'en-US-AnaNeural' } = req.body;

  if (!name || !systemPrompt) {
    return res.status(400).json({ error: "Missing name or systemPrompt." });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO characters (name, system_prompt, avatar_type, avatar_path, ai_provider, tts_provider, voice_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, systemPrompt, avatarType, avatarPath, aiProvider, ttsProvider, voiceId);
    
    res.json({ 
      id: result.lastInsertRowid, 
      name, 
      systemPrompt, 
      avatarType, 
      avatarPath, 
      aiProvider, 
      ttsProvider, 
      voiceId 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT to update a Character
router.put('/characters/:id', (req, res) => {
  const { id } = req.params;
  const { name, systemPrompt, avatarType = '2d', avatarPath = '', aiProvider = 'gemini', ttsProvider = 'edge-tts', voiceId = 'en-US-AnaNeural' } = req.body;

  if (!name || !systemPrompt) {
    return res.status(400).json({ error: "Missing name or systemPrompt." });
  }

  try {
    const stmt = db.prepare(`
      UPDATE characters 
      SET name = ?, system_prompt = ?, avatar_type = ?, avatar_path = ?, ai_provider = ?, tts_provider = ?, voice_id = ?
      WHERE id = ?
    `);
    const result = stmt.run(name, systemPrompt, avatarType, avatarPath, aiProvider, ttsProvider, voiceId, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ error: "Character not found." });
    }
    
    res.json({ 
      id: parseInt(id), 
      name, 
      systemPrompt, 
      avatarType, 
      avatarPath, 
      aiProvider, 
      ttsProvider, 
      voiceId 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a Character
router.delete('/characters/:id', (req, res) => {
  const { id } = req.params;
  if (parseInt(id) === 1) {
    return res.status(400).json({ error: "Cannot delete the default character." });
  }

  try {
    const character = db.prepare('SELECT is_default FROM characters WHERE id = ?').get(id);
    if (!character) {
      return res.status(404).json({ error: "Character not found." });
    }

    const transaction = db.transaction(() => {
      db.prepare('DELETE FROM characters WHERE id = ?').run(id);
      if (character.is_default === 1) {
        const nextChar = db.prepare('SELECT id FROM characters ORDER BY id ASC LIMIT 1').get();
        if (nextChar) {
          db.prepare('UPDATE characters SET is_default = 1 WHERE id = ?').run(nextChar.id);
        }
      }
    });
    transaction();

    res.json({ message: "Character deleted successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
