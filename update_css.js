import fs from 'fs';

const path = 'client/src/components/AdminTaskEditorModal.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Reducir padding exterior del modal head y foot
content = content.replace(/className="p-4 sm:p-6 border-b/g, 'className="p-3 sm:p-6 border-b');
content = content.replace(/className="p-4 sm:p-6 border-t/g, 'className="p-3 sm:p-6 border-t');
content = content.replace(/className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4/g, 'className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4');

// 2. Reducir padding interior de los días
content = content.replace(/className="p-3 sm:p-4 space-y-3"/g, 'className="p-2 sm:p-4 space-y-3"');
content = content.replace(/rounded-xl p-3 sm:p-3\.5/g, 'rounded-xl p-2 sm:p-3');

// 3. Achicar botones de flecha
content = content.replace(/className="w-7 h-7/g, 'className="w-6 h-6');

// 4. Achicar botones de eliminar (basura)
content = content.replace(/className="p-2\.5 bg-rose-500\/10/g, 'className="p-1.5 bg-rose-500/10');

// 5. Reducir gap de items
content = content.replace(/gap-2\.5 items-start/g, 'gap-1.5 items-start');

fs.writeFileSync(path, content, 'utf8');
console.log('Padding and sizes updated successfully.');
