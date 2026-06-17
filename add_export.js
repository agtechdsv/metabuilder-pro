const fs = require('fs');

let bpm = fs.readFileSync('src/components/studio/bpm/BpmCanvas.tsx', 'utf8').split('\n');

if (!bpm.join('\n').includes('export function BpmCanvas(props: BpmCanvasProps)')) {
  bpm.push('');
  bpm.push('export function BpmCanvas(props: BpmCanvasProps) {');
  bpm.push('  return (');
  bpm.push('    <ReactFlowProvider>');
  bpm.push('      <BpmCanvasContent {...props} />');
  bpm.push('    </ReactFlowProvider>');
  bpm.push('  );');
  bpm.push('}');
  
  fs.writeFileSync('src/components/studio/bpm/BpmCanvas.tsx', bpm.join('\n'));
}

console.log('Added export back.');
