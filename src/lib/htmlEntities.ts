// HTML 엔티티 디코딩 — 의존성 없는 순수 함수. 서버/클라이언트/컴포넌트 어디서나 import.
//
// 명명 엔티티(&amp; 등) + 숫자 엔티티(10진 &#51032; / 16진 &#xc758;) 모두 처리한다.
// Instagram 등은 og:title/description에 한글을 16진 숫자 엔티티로 인코딩해 주므로
// 숫자 엔티티 처리가 필수.

function safeFromCodePoint(cp: number): string {
  // 잘못된 코드포인트(범위 밖)는 String.fromCodePoint가 RangeError → 무시.
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

export function decodeEntities(input: string | null | undefined): string {
  if (!input) return '';
  return input
    // 숫자 엔티티 먼저 — 16진(&#x..;) → 10진(&#..;)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => safeFromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeFromCodePoint(parseInt(d, 10)))
    // 명명 엔티티
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    // &amp;는 마지막 — 먼저 풀면 뒤따르는 치환이 의도치 않게 재해석될 수 있음.
    .replace(/&amp;/g, '&');
}
