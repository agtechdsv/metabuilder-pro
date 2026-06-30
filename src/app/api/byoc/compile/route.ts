import { NextResponse } from 'next/server'
import * as esbuild from 'esbuild'

export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Nenhum código fornecido' }, { status: 400 })
    }

    // Usamos o esbuild para compilar o React TSX para Javascript ESM
    const result = await esbuild.transform(code, {
      loader: 'tsx',
      format: 'esm',
      minify: true,
      target: 'es2020',
      jsx: 'automatic', // Transforma JSX usando o novo transform do React (não precisa de import React)
    })

    let compiledCode = result.code

    // IMPORTANTE: Como o código gerado vai ser importado dinamicamente no navegador,
    // o navegador não sabe resolver "import X from 'react'". 
    // Então, nós trocamos o 'react' local por um CDN global (esm.sh) que fornece o React no formato ESM.
    compiledCode = compiledCode.replace(
      /from\s*["']react["']/g,
      "from 'https://esm.sh/react@19.2.4'"
    )
    
    compiledCode = compiledCode.replace(
      /from\s*["']lucide-react["']/g,
      "from 'https://esm.sh/lucide-react@0.400.0'"
    )
    
    // Suporte para o jsx-runtime (que é adicionado pelo jsx: 'automatic' do esbuild)
    compiledCode = compiledCode.replace(
      /from\s*["']react\/jsx-runtime["']/g,
      "from 'https://esm.sh/react@19.2.4/jsx-runtime'"
    )

    return NextResponse.json({ compiled_code: compiledCode })
  } catch (error: any) {
    console.error('[API] BYOC Compile Error:', error)
    return NextResponse.json(
      { error: 'Erro ao compilar o código', details: error.message },
      { status: 500 }
    )
  }
}
