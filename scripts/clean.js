const fs = require('fs');
const path = require('path');
const dirs = ['.next', path.join('node_modules', '.cache')];
for (const d of dirs) {
  try {
    if (fs.existsSync(d)) {
      fs.rmSync(d, { recursive: true, force: true });
      console.log('Removed', d);
    }
  } catch (e) {
    console.warn('Could not remove', d, e.message);
  }
}
