const fs = require('fs');
const path = require('path');

function fixImports(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fixImports(fullPath);
    } else if (file === 'route.ts') {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes("from '@/lib/prisma'")) {
        const relativePath = path.relative(path.dirname(fullPath), path.join(process.cwd(), 'app/lib/prisma')).replace(/\\/g, '/');
        content = content.replace("from '@/lib/prisma'", `from '${relativePath}'`);
        fs.writeFileSync(fullPath, content);
        console.log('Fixed:', fullPath);
      }
    }
  }
}

fixImports(path.join(process.cwd(), 'app/api'));
console.log('Done');