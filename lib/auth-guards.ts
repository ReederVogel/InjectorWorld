import { NextResponse } from 'next/server'

export function requireAdmin(user: any): NextResponse | null {
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Admin only.' }, { status: 403 })
  return null
}

export function requireAdminOrEditor(user: any): NextResponse | null {
  if (!user || !['admin', 'editor'].includes(user.role))
    return NextResponse.json({ error: 'Admin or editor only.' }, { status: 403 })
  return null
}
