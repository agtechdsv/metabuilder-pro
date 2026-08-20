import { NextResponse } from 'next/server'
import * as esbuild from 'esbuild'

export async function POST(req: Request) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json({ error: 'Nenhum código fornecido' }, { status: 400 })
    }

    // Usamos o esbuild para compilar o React TSX para Javascript CJS
    // Utilizamos CommonJS (cjs) em vez de ESM porque vamos avaliar o código 
    // injetando um mock do require no cliente, garantindo que o componente BYOC
    // utilize a MESMA instância do React da aplicação host, evitando erros de "#525" (Objects are not valid as a React child).
    const result = await esbuild.transform(code, {
      loader: 'tsx',
      format: 'cjs',
      minify: true,
      target: 'es2020',
      jsx: 'automatic',
    })

    const compiledCode = result.code

    return NextResponse.json({ compiled_code: compiledCode })
  } catch (error: any) {
    console.error('[API] BYOC Compile Error:', error)
    return NextResponse.json(
      { error: 'Erro ao compilar o código', details: error.message },
      { status: 500 }
    )
  }
}
