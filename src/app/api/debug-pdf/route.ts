import { NextRequest, NextResponse } from 'next/server'
import pdfParse from 'pdf-parse'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await pdfParse(buffer)

  return NextResponse.json({
    text: result.text,
    lines: result.text.split('\n').map((l, i) => `${i}: ${l}`).slice(0, 100)
  })
}
