// 포트원 V2 환경변수 + 작은 헬퍼.
//
// V2 의 전제:
//   - storeId: 상점 식별 (NEXT_PUBLIC + server 둘 다)
//   - channelKey: PG/결제수단 채널 — 카카오/네이버/구글페이마다 별개로 콘솔에서 발급
//   - paymentId: 우리가 만든 고유값. 우리 order_no 를 그대로 사용 → 1:1 매핑
//
// 환경변수는 .env.local 에 자리 마련됨(P0 단계). 채널 키는 콘솔 가입 후 채워야 동작.

export type PgProvider = 'card' | 'kakao' | 'naver' | 'google';

// 지원 결제수단 단일 원천 — UI 라디오·서버 검증·payPayload 가 모두 이 목록을 공유한다.
// (과거 'card' 추가 시 UI/SDK 만 반영되고 서버 validate 가 누락돼 신용카드 결제가
//  막히는 드리프트가 있었음. 목록을 한 곳에 두어 재발 방지.)
export const PG_PROVIDERS: readonly PgProvider[] = ['card', 'kakao', 'naver', 'google'];

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
  // 모든 결제수단이 동일한 KG이니시스 V2 채널을 사용 — payMethod 만 다르게 보냄.
  // 채널키 4개 자리에 같은 값을 두는 게 권장이지만, 안전을 위해 fallback 체인으로 1개라도 있으면 사용.
  switch (provider) {
    case 'card':   return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO
                     ?? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVER
                     ?? process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_GOOGLE
                     ?? '';
    case 'kakao':  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_KAKAO ?? '';
    case 'naver':  return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_NAVER ?? '';
    case 'google': return process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY_GOOGLE ?? '';
  }
}

// 결제 라벨 — provider 별 표기.
export function providerLabel(p: PgProvider): string {
  switch (p) {
    case 'card':   return '신용카드';
    case 'kakao':  return '카카오페이';
    case 'naver':  return '네이버페이';
    case 'google': return '구글페이';
  }
}

// PortOne V2 결제수단 페이로드 — KG이니시스 V2 기준.
//   - 카카오·네이버: EASY_PAY + easyPay.easyPayProvider
//   - 구글페이: 이니시스 V2 의 EASY_PAY 범주에 없음 → CARD 로 fallback
//     (사용자가 구글페이 버튼을 눌러도 결제창에서 카드 결제 → 본인 카드 등록되어 있으면 구글페이 카드로 결제 가능)
//
// PortOne SDK 는 string literal union 으로 좁힌 타입을 요구 — as const 로 literal 유지.
export function payPayload(p: PgProvider) {
  switch (p) {
    case 'card':
      return { payMethod: 'CARD' } as const;
    case 'kakao':
      return {
        payMethod: 'EASY_PAY',
        easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_KAKAOPAY' },
      } as const;
    case 'naver':
      return {
        payMethod: 'EASY_PAY',
        easyPay: { easyPayProvider: 'EASY_PAY_PROVIDER_NAVERPAY' },
      } as const;
    case 'google':
      return { payMethod: 'CARD' } as const;
  }
}

// 전화번호 정규화 — 숫자만. 비교/저장 일관성용. RPC 측 정규식과 동일.
export function normalizePhone(raw: string): string {
  return (raw ?? '').replace(/\D/g, '');
}
