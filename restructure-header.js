import fs from 'fs';
const path = 'client/src/components/PartnerDashboardView.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update <header> tag
content = content.replace(
  /<header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-3 sm:px-4 sm:py-3 rounded-2xl shadow-xl flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2\.5 w-full max-w-full overflow-hidden">/,
  '<header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 p-3 sm:px-4 sm:py-3 rounded-2xl shadow-xl flex flex-col gap-3 w-full max-w-full overflow-hidden">'
);

// 2. Add Row 1 Wrapper
content = content.replace(
  /\{\/\* Title & Selector \(compact\) \*\/\}/,
  `{/* Top Row: Title & Week Selector */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 w-full">
          {/* Title (compact) */}`
);

// 3. Close Row 1 Wrapper before Mobile Quick Action
content = content.replace(
  /\{\/\* Mobile Quick Action & Menu Bar \(visible on mobile \/ tablet\) \*\/\}/,
  `</div>\n\n        {/* Mobile Quick Action & Menu Bar (visible on mobile / tablet) */}`
);

// 4. Update Toolbar Wrapper
content = content.replace(
  /<div className="hidden lg:flex items-center gap-1\.5 ml-auto max-w-full overflow-x-auto no-scrollbar pb-0\.5">/,
  '<div className="hidden lg:flex items-center justify-start gap-1.5 w-full overflow-x-auto no-scrollbar pt-2 border-t border-slate-800/80">'
);

// 5. Add whitespace-nowrap to all span inside buttons in the toolbar section
// Actually, it's easier to just add whitespace-nowrap to the toolbar container. 
// No, flex items text wrap if not specified. Let's add whitespace-nowrap to the spans inside buttons in that section.
const startIndex = content.indexOf('{/* Right: Desktop Action buttons toolbar');
const endIndex = content.indexOf('{/* Modales y Drawers');
if (startIndex !== -1 && endIndex !== -1) {
  let section = content.slice(startIndex, endIndex);
  section = section.replace(/<span([^>]*)>([^<]*)<\/span>/g, (match, p1, p2) => {
    if (!p1.includes('whitespace-nowrap') && !p1.includes('truncate')) {
      return `<span${p1} className="whitespace-nowrap">${p2}</span>`;
    }
    return match;
  });
  content = content.slice(0, startIndex) + section + content.slice(endIndex);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Header restructured successfully!');
