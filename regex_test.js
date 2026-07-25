const { transform } = require("sucrase");
const React = require("react"); // actual react

const code = `
import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';

export default function Test() {
  const [s] = useState(1);
  const cli = createClient();
  return React.createElement('div', null, "Test OK " + s);
}
`;

const res = transform(code, {
  transforms: ["typescript", "jsx", "imports"],
  jsxRuntime: "classic"
});

const factory = new Function("require", "exports", res.code);
const exportsObj = {};
const customRequire = (mod) => {
  if (mod === 'react') return React;
  if (mod === 'lucide-react') return { Search: () => 'search' };
  if (mod === '@/utils/supabase/client') return { createClient: () => 'supabase' };
  return {};
};

factory(customRequire, exportsObj);

console.log("DEFAULT EXPORT:", exportsObj.default);
try {
  console.log("RESULT OF DEFAULT EXPORT:", exportsObj.default());
} catch(e) {
  console.error("ERROR:", e);
}
