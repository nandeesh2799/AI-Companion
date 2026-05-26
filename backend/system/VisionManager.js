const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class VisionManager {
  // Capture screen and return as base64 png
  static captureScreen() {
    return new Promise((resolve, reject) => {
      const outputPath = '/tmp/desktop_capture.png';
      
      // Try scrot, fallback to gnome-screenshot, fallback to import (ImageMagick)
      const command = `scrot -z "${outputPath}" || gnome-screenshot -f "${outputPath}" || import -window root "${outputPath}"`;
      
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.warn("Screen capture command failed. Trying fallback commands.", stderr);
          // If all CLI fail, write a blank dummy png or reject
          return reject(new Error("No compatible screen capture tool installed (scrot, gnome-screenshot, or ImageMagick required)."));
        }

        try {
          if (fs.existsSync(outputPath)) {
            const bitmap = fs.readFileSync(outputPath);
            const base64Image = Buffer.from(bitmap).toString('base64');
            
            // Async clean up screenshot file
            fs.unlink(outputPath, (err) => {
              if (err) console.error("Failed to delete temp screenshot:", err.message);
            });
            
            resolve(base64Image);
          } else {
            reject(new Error("Screenshot file was not created."));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
  }
}

module.exports = VisionManager;
