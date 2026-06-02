import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export async function POST(request: Request) {
  try {
    const { text, type } = await request.json()

    if (!text || !type) {
      return NextResponse.json({ error: 'text e type são obrigatórios' }, { status: 400 })
    }

    let hash = ''

    if (type === 'plain') {
      hash = text
    } else if (type === 'md5') {
      hash = crypto.createHash('md5').update(text).digest('hex')
    } else if (type === 'sha256') {
      hash = crypto.createHash('sha256').update(text).digest('hex')
    } else if (type === 'bcrypt') {
      const salt = bcrypt.genSaltSync(10)
      hash = bcrypt.hashSync(text, salt)
    } else {
      return NextResponse.json({ error: 'Tipo de hash não suportado' }, { status: 400 })
    }

    return NextResponse.json({ hash })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
