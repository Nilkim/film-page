import type { Metadata } from "next";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";

// 폰트는 globals.css에서 Pretendard(CDN variable)로 통일 — handoff 지정.
// next/font(Geist)는 디자인 방향 변경으로 제거.

export const metadata: Metadata = {
  title: "FilmArtwork — 필름 커팅 작품 커뮤니티 · COTYLEDON",
  description:
    "사용자들이 필름 커팅으로 만든 작품을 공유하고 자랑하는 커뮤니티. 커팅 도면은 FilmCutting 에디터로 만들어 주문하고 공유할 수 있어요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      {/*
        suppressHydrationWarning: ColorZilla 같은 일부 브라우저 확장이 body에
        `cz-shortcut-listen` 등 속성을 주입해 hydration mismatch가 발생하는
        걸 무시. 해당 노드의 속성 mismatch만 억제하며 자식 트리의 진짜
        버그는 그대로 보고됨.
      */}
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
