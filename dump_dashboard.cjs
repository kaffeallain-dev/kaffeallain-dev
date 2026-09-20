const fs = require('fs');
const content = fs.readFileSync('src/views/DashboardView.tsx', 'utf8');
const lines = content.split('\n');
let i = 0;
while (i < lines.length) {
  console.log(lines.slice(i, i+150).join('\n'));
  i += 150;
}
