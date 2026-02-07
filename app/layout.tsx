import React from "react"
import type { Metadata, Viewport } from 'next'
import { Noto_Sans_JP } from 'next/font/google'

import './globals.css'

const _notoSansJP = Noto_Sans_JP({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'シフト管理 - Workshop Staff Manager',
  description: 'ワークショップスタッフのシフト管理システム',
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
