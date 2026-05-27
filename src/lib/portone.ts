// 포트원 V2 환경변수 + 작은 헬퍼.
//
// V2 의 전제:
//   - storeId: 상점 식별 (NEXT_PUBLIC + server 둘 다)
//   - channelKey: PG/결제수단 채널 — 카카오/네이버/구글페이마다 별개로 콘솔에서 발급
//   - paymentId: 우리가 만든 고유값. 우리 order_no 를 그대로 사용 → 1:1 매핑
//
// 환경변수는 .env.local 에 자리 마련됨(P0 단계). 채널 키는 콘솔 가입 후 채워야 동작.

export type PgProvider = 'kakao' | 'naver' | 'google';

// 브라우저에서 사용할 client config — NEXT_PUBLIC_ env 만 사용.
export type PortOneClientConfig = {
  storeId: string;
  channelKey: string;
};

export function getClientConfig(provider: PgProvider): PortOneClientConfig {
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? '';
  const channelKey = pickChannelKey(provider);
  return { storeId, channelKey };
}

function pickChannelKey(provider: PgProvider): string {
  switch (provider) {
    case 'kakao':  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO ?? '';
    case 'naver':  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVER ?? '';
    case 'google': return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_GOOGLE ?? '';
  }
}

// 결제 라벨 — provider 별 표기.
export function providerLabel(p: PgProvider): string {
  switch (p) {
    case 'kakao':  return '카카오페이';
    case 'naver':  return '네이버페이';
    case 'google': return '구글페이';
  }
}

// 전화번호 정규화 — 숫자만. 비교/저장 일관성용. RPC 측 정규식과 동일.
export function normalizePhone(raw: string): string {
  return (raw ?? '').replace(/\D/g, '');
}
