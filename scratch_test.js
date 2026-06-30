const esbuild = require('esbuild');

async function run() {
  const result = await esbuild.transform(`
    import React from 'react';
    import { Check } from 'lucide-react';
    export default function Test() { return <div>Test <Check /></div>; }
  `, {
    loader: 'tsx',
    format: 'esm',
    minify: true,
    target: 'es2020',
    jsx: 'automatic',
  });
  console.log(result.code);
}

run();
