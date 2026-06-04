// 메일 발송 헬퍼 — Resend 기반.
//
// 정책:
//   - RESEND_API_KEY 없으면 console.warn 만 하고 skip (배포 환경에 키 안 넣어도 빌드·동작 안 깨짐).
//   - 발신 주소는 MAIL_FROM env. 도메인 인증 전엔 Resend 의 onboarding@resend.dev 사용 가능.
//   - 수신 주소가 비어 있으면 skip (선택 입력이라 빈 값이 정상 경로).
//   - BCC 로 관리자 메일(BACKUP_BCC) 한 통 자동 복사 → 사용자가 운영 채널에서도 확인 가능.
//
// 두 종류:
//   1. sendPaymentConfirmation — 결제 완료 직후 (webhook 에서 호출)
//   2. sendShippingNotification — 관리자가 발송 처리할 때
//
// 보안: server-only. NEXT_PUBLIC_ prefix 안 붙임. 클라이언트 컴포넌트에서 import 금지.

const SHOP_NAME = '필름아트웍 (FilmArtwork)';
const SHOP_EMAIL = 'cotyledon79@naver.com';
const SITE_URL = 'https://film-artwork.com';

// 택배 추적 URL — 사용자가 운송장만 클릭해도 바로 추적되게.
// 캐리어 키 → URL 빌더.
const TRACKING_URL: Record<string, (n: string) => string> = {
  cj:     (n) => `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvcNo=${encodeURIComponent(n)}`,
  hanjin: (n) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${encodeURIComponent(n)}`,
  lotte:  (n) => `https://www.lotteglogis.com/home/reservation/tracking/index?InvNo=${encodeURIComponent(n)}`,
  epost:  (n) => `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${encodeURIComponent(n)}`,
};

export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  if (!carrier || !number) return null;
  const builder = TRACKING_URL[carrier.toLowerCase()];
  return builder ? builder(number) : null;
}

export const CARRIER_LABELS: Record<string, string> = {
  cj:     'CJ대한통운',
  hanjin: '한진택배',
  lotte:  '롯데택배',
  epost:  '우체국택배',
  custom: '기타',
};

// 내부 — Resend 호출. 동적 import 라 SDK 미설치 환경에서도 빌드 깨지지 않음.
async function send(opts: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? 'onboarding@resend.dev';
  const bcc = process.env.MAIL_BACKUP_BCC ?? SHOP_EMAIL;
  if (!apiKey) {
    console.warn('[mail] RESEND_API_KEY 미설정 — 메일 발송 skip:', { to: opts.to, subject: opts.subject });
    return;
  }
  if (!opts.to) {
    console.warn('[mail] 수신 주소 비어있음 — skip');
    return;
  }
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${SHOP_NAME} <${from}>`,
      to: opts.to,
      bcc: bcc !== opts.to ? bcc : undefined,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) console.warn('[mail] resend error:', error);
  } catch (e) {
    console.warn('[mail] send failed:', (e as Error).message);
  }
}

// 메일 본문 정보 테이블의 <tr> 묶음 생성 — 결제완료/발송완료 메일이 공유.
// 첫 행만 border-top 을 빼고, 둘째 행부터 구분선을 넣는다(기존 마크업과 동일).
// value 에 monospace/bold 등 행별 스타일이 필요하면 호출 측이 <span style> 로 감싼다.
function emailTableRows(rows: Array<{ label: string; value: string }>): string {
  return rows
    .map(({ label, value }, i) => {
      const top = i === 0 ? '' : 'border-top:1px solid #e8e3d8;';
      return `<tr><td style="padding:10px 14px;color:#9a8f7a;font-size:12px;${top}">${label}</td>
          <td style="padding:10px 14px;${top}color:#1b1610;">${value}</td></tr>`;
    })
    .join('\n      ');
}

// 공통 레이아웃 wrapping — 외부 메일 클라이언트 호환성을 위해 inline-style 위주.
function shell(title: string, body: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f8f6f1;font-family:-apple-system,BlinkMacSystemFont,'Pretendard',sans-serif;color:#1b1610;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e8e3d8;border-radius:6px;">
    <tr><td style="padding:24px 28px 8px;">
      <div style="font-size:11px;letter-spacing:0.2em;color:#9a8f7a;text-transform:uppercase;">${SHOP_NAME}</div>
      <h1 style="margin:8px 0 0;font-size:20px;color:#1b1610;letter-spacing:-0.02em;">${title}</h1>
    </td></tr>
    <tr><td style="padding:8px 28px 24px;font-size:14px;line-height:1.7;color:#3f3a30;">
      ${body}
    </td></tr>
    <tr><td style="padding:16px 28px;border-top:1px solid #e8e3d8;font-size:11px;color:#9a8f7a;">
      문의: <a href="mailto:${SHOP_EMAIL}" style="color:#3f3a30;text-decoration:underline;">${SHOP_EMAIL}</a> ·
      <a href="${SITE_URL}/orders/lookup" style="color:#3f3a30;text-decoration:underline;">주문조회</a>
    </td></tr>
  </table>
</body></html>`;
}

// 1) 결제 완료 알림
export async function sendPaymentConfirmation(args: {
  to: string;
  orderNo: string;
  customerName: string;
  total: number;
  orderName?: string;
}): Promise<void> {
  const lookup = `${SITE_URL}/orders/lookup?orderNo=${encodeURIComponent(args.orderNo)}`;
  const rows = [
    { label: '주문번호', value: `<span style="font-family:'SFMono-Regular',Menlo,monospace;font-weight:bold;">${args.orderNo}</span>` },
    ...(args.orderName ? [{ label: '상품', value: escapeHtml(args.orderName) }] : []),
    { label: '총 결제금액', value: `<span style="font-weight:bold;">${args.total.toLocaleString('ko-KR')}원</span>` },
  ];
  const body = `
    <p>${args.customerName} 님, 결제가 완료되었습니다. 감사합니다.</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border:1px solid #e8e3d8;border-radius:4px;">
      ${emailTableRows(rows)}
    </table>
    <p>주문 진행 상황은 아래 링크에서 확인하실 수 있습니다.</p>
    <p style="margin:18px 0;">
      <a href="${lookup}" style="display:inline-block;background:#1b1610;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:13px;">주문조회 바로가기</a>
    </p>
    <p style="font-size:12px;color:#9a8f7a;">결제 후 상품 준비·발송 알림이 별도로 발송됩니다.</p>
  `;
  await send({
    to: args.to,
    subject: `[필름아트웍] 주문 ${args.orderNo} 결제가 완료되었습니다`,
    html: shell('결제가 완료되었습니다', body),
  });
}

// 2) 발송 완료 알림 (운송장 포함)
export async function sendShippingNotification(args: {
  to: string;
  orderNo: string;
  customerName: string;
  carrier: string | null;
  trackingNumber: string | null;
}): Promise<void> {
  const carrierLabel = args.carrier ? (CARRIER_LABELS[args.carrier] ?? args.carrier) : '택배사 미지정';
  const trackUrl = trackingUrl(args.carrier, args.trackingNumber);
  const lookup = `${SITE_URL}/orders/lookup?orderNo=${encodeURIComponent(args.orderNo)}`;
  const rows = [
    { label: '주문번호', value: `<span style="font-family:'SFMono-Regular',Menlo,monospace;font-weight:bold;">${args.orderNo}</span>` },
    { label: '택배사', value: escapeHtml(carrierLabel) },
    { label: '운송장 번호', value: `<span style="font-family:'SFMono-Regular',Menlo,monospace;">${escapeHtml(args.trackingNumber ?? '미지정')}</span>` },
  ];
  const body = `
    <p>${args.customerName} 님, 주문하신 상품이 발송되었습니다.</p>
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;border:1px solid #e8e3d8;border-radius:4px;">
      ${emailTableRows(rows)}
    </table>
    ${trackUrl ? `<p style="margin:18px 0;">
      <a href="${trackUrl}" style="display:inline-block;background:#1b1610;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:13px;">택배 추적</a>
      <a href="${lookup}" style="display:inline-block;margin-left:6px;color:#3f3a30;text-decoration:underline;padding:10px;font-size:13px;">주문조회</a>
    </p>` : `<p style="margin:18px 0;">
      <a href="${lookup}" style="display:inline-block;background:#1b1610;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:999px;font-size:13px;">주문조회</a>
    </p>`}
  `;
  await send({
    to: args.to,
    subject: `[필름아트웍] 주문 ${args.orderNo} 발송 완료`,
    html: shell('상품이 발송되었습니다', body),
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c] as string));
}
