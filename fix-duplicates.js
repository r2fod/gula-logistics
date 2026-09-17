import fs from 'fs';
const path = 'client/src/components/PartnerDashboardView.jsx';
let content = fs.readFileSync(path, 'utf8');

// The regex matches: className="something" className="whitespace-nowrap"
// or className={something} className="whitespace-nowrap"
content = content.replace(/className=("[^"]*"|\{[^}]*\})\s+className="whitespace-nowrap"/g, (match, p1) => {
  // We can just append whitespace-nowrap inside the first className if it's a string
  if (p1.startsWith('"')) {
    return `className="${p1.slice(1, -1)} whitespace-nowrap"`;
  } else {
    // If it's a JS expression like className={isCompleted ? 'a' : 'b'}
    // We can't easily merge it without template literals, so we replace with:
    // className={\`\${isCompleted ? 'a' : 'b'} whitespace-nowrap\`}
    // But p1 contains {expr}. We slice { and }.
    return `className={\`\${${p1.slice(1, -1)}} whitespace-nowrap\`}`;
  }
});

fs.writeFileSync(path, content, 'utf8');
console.log('Duplicates fixed!');
